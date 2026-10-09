// scripts/lib/products/hces.mjs — Household Consumption Expenditure Survey.
//
// Two survey rounds only (2022-23 and 2023-24) — the API does not serve the
// 2011-12 or earlier NSS CES rounds, and they would not be comparable anyway
// (methodology changed); nothing here is ever spliced with older rounds.
// Fiscal-year survey labels plot at April of the first year ("2023-24" ->
// 2023-04). All 9 indicators are small (~25k rows in total), so each is
// ingested IN FULL (paged, limit=500, keyed by indicator_code only) and
// sliced client-side. Bundles:
//   hces-mpce.json              — All-India MPCE, rural/urban × with/without imputation
//   hces-states.json            — state × sector MPCE (without imputation)
//   hces-fractiles.json         — MPCE over 12 fractile classes, All-India
//   hces-categories.json        — %-share of MPCE over broad item categories
//   hces-gini.json              — Gini coefficient of PCE by sector
//   hces-social.json            — All-India MPCE by social group × sector (ind 8)
//   hces-household-type.json    — All-India MPCE by household employment type × sector (ind 7)
//   hces-quantities.json        — All-India per-capita monthly cereal quantity, kg (ind 5)
//   hces-item-values.json       — All-India per-capita monthly cereal value, ₹ (ind 6)
//   hces-categories-states.json — food share of MPCE by state × sector (ind 4, state grain)
// "Without Imputation" is the headline convention; "With Imputation" adds the
// imputed value of items received free through social welfare programmes.
// Indicator 3 (broad categories in ₹) is deliberately NOT baked as a bundle:
// each of its rupee figures equals the published share (ind 4) times MPCE
// (ind 1) within rounding, and its cereal row duplicates ind 6's Total
// Cereals — it is exercised as a validation cross-check instead
// (scripts/validate.mjs reads it from the raw dump).

import { mospi } from "../mospi.mjs";
import { writeSeries, writeRaw } from "../util.mjs";
import fs from "node:fs";
import path from "node:path";

const GREYS = ["#5F6675", "#878D99", "#A3A9B4", "#C9CED6"];
const slugify = (s) => String(s).trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
const fyStart = (fy) => `${String(fy).slice(0, 4)}-04`; // "2023-24" -> "2023-04"

async function fetchAll(code) {
  const rows = [];
  let page = 1;
  for (;;) {
    const res = await mospi("hces/getHcesRecords", { indicator_code: code, page, limit: 500 });
    rows.push(...(res.data ?? []));
    const tp = res.meta_data?.totalPages ?? 1;
    if (page % 5 === 0 || page >= tp) process.stdout.write(`hces ind ${code}: page ${page}/${tp} (${rows.length} rows)\n`);
    if (page >= tp) break;
    page++;
  }
  // unstable paging shows up as the same row twice (and another missing): never bake that
  const seen = new Set();
  for (const r of rows) {
    const { value, ...dims } = r;
    const k = JSON.stringify(dims);
    if (seen.has(k)) throw new Error(`HCES indicator ${code}: duplicate row ${k}: the API paged unstably; refetch with MOSPI_NO_CACHE=1`);
    seen.add(k);
  }
  return rows;
}

export async function buildHces(root, dcfg, vintage) {
  // HCES_FROM_RAW=1 rebakes from the archived dump instead of refetching (the two survey
  // rounds are final; the dump is the complete row-set of every indicator)
  let byInd = {}; // code -> rows
  if (process.env.HCES_FROM_RAW === "1") byInd = JSON.parse(fs.readFileSync(path.join(root, "data/raw/hces-records.json"), "utf8")).indicators;
  else for (const code of Object.keys(dcfg.fetch.indicators)) byInd[code] = await fetchAll(code);
  writeRaw(root, "data/raw/hces-records.json", {
    vintage,
    note: "Complete row-sets of all 9 HCES indicators from hces/getHcesRecords (both survey rounds).",
    indicators: byInd,
  });
  // vintage = the date the DATA last changed: writeRaw keeps the dump's old stamp when the
  // body is unchanged, and the bundles carry that stamp, never the run date (hard rule 5)
  vintage = JSON.parse(fs.readFileSync(path.join(root, "data/raw/hces-records.json"), "utf8")).vintage;

  // the two survey rounds present in the rows, oldest first
  const years = [...new Set(Object.values(byInd).flat().map((r) => r.year))].sort();
  const axis = years.map(fyStart);
  const dates = axis.map((ym) => `${ym}-01`);
  const val = (r) => {
    const v = parseFloat(r.value);
    return Number.isFinite(v) ? v : null;
  };
  const metaBase = {
    dossier: "hces", frequency: "annual", base: dcfg.base,
    source: dcfg.source_agency, vintage, mock: false,
    geo: dcfg.geo ?? "IND",
    latestPeriod: axis.at(-1), releaseDate: null,
    revisionPolicy: dcfg.revision_policy,
  };
  // rows -> Map("YYYY-MM" -> value) over the two survey rounds
  const toMap = (rows) => {
    const m = new Map();
    for (const r of rows) {
      const v = val(r);
      if (v != null) m.set(fyStart(r.year), v);
    }
    return m;
  };
  const data = (m) => axis.map((ym) => m.get(ym) ?? null);

  /* ---- hces-mpce: All-India, rural/urban × imputation variants ---- */
  const ai1 = byInd["1"].filter((r) => r.state === "All India");
  const mpceOf = (sector, imput) => toMap(ai1.filter((r) => r.sector === sector && r.imputation_type === imput));
  const imputNote = "\"Without imputation\" is the headline MPCE convention (comparable across the two rounds); \"with imputation\" adds the imputed value of items received free of cost through social welfare programmes. Only the 2022-23 and 2023-24 HCES rounds exist in the eSankhyiki API — the 2011-12 and earlier NSS CES rounds are not served and are methodologically different; these series must never be spliced with them.";
  const mpceBundle = {
    meta: { ...metaBase, coverage: "All India, rural and urban; average MPCE in ₹", note: imputNote },
    dates,
    series: {
      rural: { name: "hces_mpce_rural_inr", label: "Rural (without imputation)", color: "#2E4BD8", data: data(mpceOf("Rural", "Without Imputation")), unit: "inr" },
      urban: { name: "hces_mpce_urban_inr", label: "Urban (without imputation)", color: "#5F6675", data: data(mpceOf("Urban", "Without Imputation")), unit: "inr" },
      rural_imputed: { name: "hces_mpce_rural_imputed_inr", label: "Rural (with imputation)", color: "#878D99", data: data(mpceOf("Rural", "With Imputation")), unit: "inr" },
      urban_imputed: { name: "hces_mpce_urban_imputed_inr", label: "Urban (with imputation)", color: "#A3A9B4", data: data(mpceOf("Urban", "With Imputation")), unit: "inr" },
    },
  };

  /* ---- hces-states: state × sector MPCE, without imputation ---- */
  const stSeries = {};
  const stRows = byInd["1"].filter((r) => r.state !== "All India" && r.imputation_type === "Without Imputation");
  const stKeys = [...new Set(stRows.map((r) => `${r.state}|${r.sector}`))].sort();
  stKeys.forEach((k, i) => {
    const [state, sector] = k.split("|");
    const key = `${slugify(state)}_${slugify(sector)}`;
    stSeries[key] = {
      name: `hces_mpce_${key}_inr`, label: `${state} · ${sector}`, color: GREYS[i % GREYS.length],
      data: data(toMap(stRows.filter((r) => r.state === state && r.sector === sector))), unit: "inr",
    };
  });
  const statesBundle = {
    meta: { ...metaBase, coverage: "States/UTs × rural/urban; average MPCE in ₹, without imputation" },
    dates, series: stSeries,
  };

  /* ---- hces-fractiles: 12 fractile classes, All-India, without imputation ----
     (the rows also carry an "All" class — omitted, it duplicates hces-mpce) */
  const frRows = byInd["2"].filter((r) =>
    r.state === "All India" && r.imputation_type === "Without Imputation" && String(r.mpce_fractile_classes).trim() !== "All");
  const frSeries = {};
  // preserve the natural fractile order (source labels have stray spaces, e.g. " 5-10")
  const FR_ORDER = ["0-5", "5-10", "10-20", "20-30", "30-40", "40-50", "50-60", "60-70", "70-80", "80-90", "90-95", "95-100"];
  let fi = 0;
  for (const fc of FR_ORDER) {
    for (const sector of ["Rural", "Urban"]) {
      const rows = frRows.filter((r) => String(r.mpce_fractile_classes).trim() === fc && r.sector === sector);
      if (!rows.length) continue;
      const key = `f${slugify(fc)}_${slugify(sector)}`;
      frSeries[key] = {
        name: `hces_mpce_fractile_${key}_inr`, label: `${fc}% · ${sector}`, color: GREYS[fi++ % GREYS.length],
        data: data(toMap(rows)), unit: "inr",
      };
    }
  }
  const fractilesBundle = {
    meta: { ...metaBase, coverage: "All India, rural/urban; average MPCE within each of the 12 fractile classes of the MPCE distribution, ₹, without imputation" },
    dates, series: frSeries,
  };

  /* ---- hces-categories: %-share of MPCE over broad item categories (ind 4) ---- */
  const catRows = byInd["4"].filter((r) => r.state === "All India" && r.imputation_type === "Without Imputation");
  const catNames = [...new Set(catRows.map((r) => r.item_category))].sort();
  const catSeries = {};
  let ci = 0;
  for (const cat of catNames) {
    for (const sector of ["Rural", "Urban"]) {
      const rows = catRows.filter((r) => r.item_category === cat && r.sector === sector);
      if (!rows.length) continue;
      const key = `${slugify(cat)}_${slugify(sector)}`;
      const accent = cat === "Food Total" && sector === "Rural";
      catSeries[key] = {
        name: `hces_share_${key}_pct`, label: `${cat} · ${sector}`,
        color: accent ? "#2E4BD8" : GREYS[ci++ % GREYS.length],
        data: data(toMap(rows)), unit: "pct_of_mpce",
      };
    }
  }
  const categoriesBundle = {
    meta: {
      ...metaBase,
      coverage: "All India, rural/urban; percentage share of MPCE by broad item category (30-day recall), without imputation",
      note: "Shares include the Food Total and Non-Food Total aggregate rows alongside the detailed categories; detail categories sum to their aggregate, and Food Total + Non-Food Total = 100.",
    },
    dates, series: catSeries,
  };

  /* ---- hces-gini: Gini coefficient by sector, both imputation variants ---- */
  const giniRows = byInd["9"].filter((r) => r.state === "All India");
  const giniOf = (sector, imput) => toMap(giniRows.filter((r) => r.sector === sector && r.imputation_type === imput));
  const giniBundle = {
    meta: { ...metaBase, coverage: "All India, rural and urban; Gini coefficient of per-capita consumption expenditure", note: imputNote },
    dates,
    series: {
      rural: { name: "hces_gini_rural", label: "Rural (without imputation)", color: "#2E4BD8", data: data(giniOf("Rural", "Without Imputation")), unit: "gini" },
      urban: { name: "hces_gini_urban", label: "Urban (without imputation)", color: "#5F6675", data: data(giniOf("Urban", "Without Imputation")), unit: "gini" },
      rural_imputed: { name: "hces_gini_rural_imputed", label: "Rural (with imputation)", color: "#878D99", data: data(giniOf("Rural", "With Imputation")), unit: "gini" },
      urban_imputed: { name: "hces_gini_urban_imputed", label: "Urban (with imputation)", color: "#A3A9B4", data: data(giniOf("Urban", "With Imputation")), unit: "gini" },
    },
  };

  /* ---- hces-social: All-India MPCE by social group × sector (ind 8) ----
     ("All" is omitted — it duplicates hces-mpce exactly) */
  const SOC = [["Scheduled Tribe", "st"], ["Scheduled Caste", "sc"], ["Other Backward Class", "obc"], ["Others", "others"]];
  const socRows = byInd["8"].filter((r) => r.state === "All India" && r.imputation_type === "Without Imputation");
  const socSeries = {};
  let si = 0;
  for (const [group, gk] of SOC) {
    for (const sector of ["Rural", "Urban"]) {
      const key = `${gk}_${slugify(sector)}`;
      socSeries[key] = {
        name: `hces_mpce_social_${key}_inr`, label: `${group} · ${sector}`,
        color: gk === "st" && sector === "Rural" ? "#2E4BD8" : GREYS[si++ % GREYS.length],
        data: data(toMap(socRows.filter((r) => r.social_group === group && r.sector === sector))), unit: "inr",
      };
    }
  }
  const socialBundle = {
    meta: {
      ...metaBase,
      coverage: "All India, rural/urban; average MPCE by social group (ST/SC/OBC/Others), ₹, without imputation",
      note: "The \"All\" group is omitted (it equals the All-India MPCE in hces-mpce). Group means are averages over overlapping distributions; " + imputNote,
    },
    dates, series: socSeries,
  };

  /* ---- hces-household-type: All-India MPCE by household employment type (ind 7) ----
     Rural rows are published with an agriculture/non-agriculture split;
     urban rows carry the aggregated types. "All" is omitted (= hces-mpce). */
  const htRows = byInd["7"].filter((r) => r.state === "All India" && r.imputation_type === "Without Imputation" && r.employment_of_households !== "All");
  const htKeys = [...new Set(htRows.map((r) => `${r.employment_of_households}|${r.sector}`))].sort();
  const htSeries = {};
  htKeys.forEach((k, i) => {
    const [type, sector] = k.split("|");
    const key = `${slugify(type)}_${slugify(sector)}`;
    htSeries[key] = {
      name: `hces_mpce_hhtype_${key}_inr`, label: `${type} · ${sector}`, color: GREYS[i % GREYS.length],
      data: data(toMap(htRows.filter((r) => r.employment_of_households === type && r.sector === sector))), unit: "inr",
    };
  });
  const hhTypeBundle = {
    meta: {
      ...metaBase,
      coverage: "All India, rural/urban; average MPCE by household employment type, ₹, without imputation",
      note: "Rural types are published with an agriculture/non-agriculture split; urban types are published aggregated (self-employed, regular wage/salaried, casual labour, others). The \"All\" type is omitted (it equals the All-India MPCE in hces-mpce). " + imputNote,
    },
    dates, series: htSeries,
  };

  /* ---- hces-quantities: per-capita monthly cereal quantity, kg (ind 5) ----
     Quantities are published in the without-imputation convention only. */
  const CEREALS = ["Rice", "Wheat", "Coarse Grains", "Other Cereals", "Total Cereals"];
  const qtyRows = byInd["5"].filter((r) => r.state === "All India" && r.imputation_type === "Without Imputation");
  const qtySeries = {};
  let qi = 0;
  for (const cereal of CEREALS) {
    for (const sector of ["Rural", "Urban"]) {
      const key = `${slugify(cereal)}_${slugify(sector)}`;
      qtySeries[key] = {
        name: `hces_qty_${key}_kg`, label: `${cereal} · ${sector}`,
        color: cereal === "Total Cereals" && sector === "Rural" ? "#2E4BD8" : GREYS[qi++ % GREYS.length],
        data: data(toMap(qtyRows.filter((r) => r.cereal === cereal && r.sector === sector))), unit: "kg_per_month",
      };
    }
  }
  const quantitiesBundle = {
    meta: {
      ...metaBase,
      coverage: "All India, rural/urban; average per-capita monthly quantity of cereals consumed, kg per person per month (as published)",
      note: "The API serves cereal quantities in the without-imputation convention only. Rice + Wheat + Coarse Grains + Other Cereals sum to Total Cereals. Only the 2022-23 and 2023-24 HCES rounds exist in the eSankhyiki API; never spliced with the 2011-12 or earlier NSS CES rounds.",
    },
    dates, series: qtySeries,
  };

  /* ---- hces-item-values: per-capita monthly cereal value, ₹ (ind 6) ----
     The ₹ complement of hces-quantities, headline (without imputation)
     convention; a with-imputation variant exists in the raw dump. */
  const valRows = byInd["6"].filter((r) => r.state === "All India" && r.imputation_type === "Without Imputation");
  const valSeries = {};
  let vi = 0;
  for (const cereal of CEREALS) {
    for (const sector of ["Rural", "Urban"]) {
      const key = `${slugify(cereal)}_${slugify(sector)}`;
      valSeries[key] = {
        name: `hces_value_${key}_inr`, label: `${cereal} · ${sector}`,
        color: cereal === "Total Cereals" && sector === "Rural" ? "#2E4BD8" : GREYS[vi++ % GREYS.length],
        data: data(toMap(valRows.filter((r) => r.cereal === cereal && r.sector === sector))), unit: "inr",
      };
    }
  }
  const itemValuesBundle = {
    meta: {
      ...metaBase,
      coverage: "All India, rural/urban; average per-capita monthly value of cereals consumed, ₹ per person per month, without imputation",
      note: "The ₹ twin of hces-quantities: same cereals, same households, valued in the rupees of the day. Total Cereals here equals the Cereal row of the broad-category table in ₹ (indicator 3) — that redundancy is asserted in scripts/validate.mjs. " + imputNote,
    },
    dates, series: valSeries,
  };

  /* ---- hces-categories-states: food share of MPCE by state × sector ----
     The state grain of the shares indicator (ind 4), kept lean: one series
     per state-sector, Food Total only. The full ₹ category table (ind 3) is
     not baked — see the header note. */
  const fsRows = byInd["4"].filter((r) => r.state !== "All India" && r.imputation_type === "Without Imputation" && r.item_category === "Food Total");
  const fsKeys = [...new Set(fsRows.map((r) => `${r.state}|${r.sector}`))].sort();
  const fsSeries = {};
  fsKeys.forEach((k, i) => {
    const [state, sector] = k.split("|");
    const key = `${slugify(state)}_${slugify(sector)}`;
    fsSeries[key] = {
      name: `hces_food_share_${key}_pct`, label: `${state} · ${sector}`, color: GREYS[i % GREYS.length],
      data: data(toMap(fsRows.filter((r) => r.state === state && r.sector === sector))), unit: "pct_of_mpce",
    };
  });
  const foodStatesBundle = {
    meta: {
      ...metaBase,
      coverage: "States/UTs × rural/urban; percentage share of MPCE going to food (Food Total category, 30-day recall), without imputation",
      note: "Lean cut of the state × category grain: Food Total share only, one series per state-sector. The detail categories at state level live in the raw dump (data/raw/hces-records.json, indicators 3 and 4), not in a bundle.",
    },
    dates, series: fsSeries,
  };

  /* ---- wave 2 (2026-10-10): every indicator at every cut the API serves ----
     One series per state x sector x the indicator's own dimension, for each imputation basis
     the indicator publishes. All India sits in the same bundles as its own row (group
     "All India"), so the national figure and the states read off one table. Nothing is
     summed, filled or rescaled; "All" rows that only repeat the MPCE are left to hces-mpce. */
  // SOURCE DEFECT (found 2026-10-10, present in the live API and in the archived dump alike):
  // indicator 3 (₹ by category) prints, for 2022-23 rural without imputation, the rows of
  // Andhra Pradesh, Arunachal Pradesh, Assam, Bihar, Chhattisgarh and Delhi under Goa,
  // Gujarat, Haryana, Himachal Pradesh, Jharkhand and Karnataka (each block adds up to the
  // other state's MPCE to the rupee, and its cereal row disagrees with indicator 6). The
  // shares (indicator 4) and every other indicator are consistent. Rule, not a list: a
  // state x sector x basis x round whose Food + Non-Food rupees miss that state's own MPCE
  // (indicator 1) by more than 1% is left out of the rupee bundles, and the note names it.
  const mpceByCell = new Map(byInd["1"].map((r) => [[r.year, r.state, r.sector, r.imputation_type].join("|"), val(r)]));
  const catSum = new Map();
  for (const r of byInd["3"]) if (/^(Food Total|Non-Food Total)$/.test(r.item_category)) { const k = [r.year, r.state, r.sector, r.imputation_type].join("|"); catSum.set(k, (catSum.get(k) ?? 0) + (val(r) ?? 0)); }
  const misprinted = [...catSum].filter(([k, v]) => mpceByCell.get(k) && Math.abs(v - mpceByCell.get(k)) / mpceByCell.get(k) > 0.01).map(([k, v]) => {
    const [yr, st, sec, imp] = k.split("|");
    const twin = [...mpceByCell].find(([k2, m]) => { const p = k2.split("|"); return p[0] === yr && p[2] === sec && p[3] === imp && p[1] !== st && Math.abs(m - v) < 0.6; });
    return { k, st, yr, sec, imp, twin: twin?.[0].split("|")[1] };
  });
  const bad3 = new Set(misprinted.map((m) => m.k));
  const ind3 = byInd["3"].filter((r) => !bad3.has([r.year, r.state, r.sector, r.imputation_type].join("|")));
  const misNote = misprinted.length ? ` Left out as misprinted at source: ${misprinted.map((m) => `${m.st} ${m.sec.toLowerCase()} ${m.yr}${m.twin ? ` (carries ${m.twin}'s rows)` : ""}`).join("; ")}. Their rupee rows add up to another state's MPCE, not their own; the percentage shares for the same cells (hces-categories-states) are consistent and are kept.` : "";
  if (misprinted.length > 12) throw new Error(`HCES: ${misprinted.length} state cells of indicator 3 fail to add to their MPCE; that is no longer a local misprint`);

  const BASIS = { "Without Imputation": ["", "without imputation"], "With Imputation": ["imputed", "with imputation"] };
  const geoOrder = (a, b) => (a === "All India" ? -1 : b === "All India" ? 1 : a < b ? -1 : 1);
  const deep = (rows, dimOf, unit, basis) => {
    const series = {};
    let i = 0;
    const R = rows.filter((r) => r.imputation_type === basis);
    for (const st of [...new Set(R.map((r) => r.state))].sort(geoOrder)) {
      for (const sector of ["Rural", "Urban"]) {
        const sr = R.filter((r) => r.state === st && r.sector === sector);
        const dims = new Map();
        for (const r of sr) { const d = dimOf(r); if (d) dims.set(d.key, d); }
        for (const d of [...dims.values()].sort((a, b) => a.order - b.order)) {
          const m = toMap(sr.filter((r) => dimOf(r)?.key === d.key));
          if (!m.size) continue;
          const key = `${slugify(st)}_${slugify(sector)}${d.key ? "__" + d.key : ""}`;
          series[key] = { name: `hces_${key}`, label: `${d.label ? d.label + " · " : ""}${st} · ${sector}`, group: st,
            color: GREYS[i++ % GREYS.length], data: data(m), unit: d.unit ?? unit };
        }
      }
    }
    return series;
  };
  const CAT_ORDER = [...new Set(byInd["4"].map((r) => r.item_category))];
  const catDim = (r) => ({ key: slugify(r.item_category), label: r.item_category, order: CAT_ORDER.indexOf(r.item_category) });
  const one = () => ({ key: "", label: "", order: 0 });
  const FR = ["0-5", "5-10", "10-20", "20-30", "30-40", "40-50", "50-60", "60-70", "70-80", "80-90", "90-95", "95-100"];
  const frDim = (r) => { const f = String(r.mpce_fractile_classes).trim(); const o = FR.indexOf(f); return o < 0 ? null : { key: `f${slugify(f)}`, label: `${f}% class`, order: o }; };
  const cerDim = (r) => ({ key: slugify(r.cereal), label: r.cereal, order: CEREALS.indexOf(r.cereal) });
  const HT_ORDER = ["Self employed in agriculture", "Self employed in non-agriculture", "Regular wage/salaried in agriculture", "Regular wage/salaried in non-agriculture", "Casual labour in agriculture", "Casual labour in non-agriculture", "Self employed", "Regular wage/salaried", "Casual labour", "Others"];
  const htDim = (r) => { const o = HT_ORDER.indexOf(r.employment_of_households); return o < 0 ? null : { key: slugify(r.employment_of_households), label: r.employment_of_households, order: o }; };
  const SG_ORDER = ["Scheduled Tribe", "Scheduled Caste", "Other Backward Class", "Others"];
  const sgDim = (r) => { const o = SG_ORDER.indexOf(r.social_group); return o < 0 ? null : { key: slugify(r.social_group), label: r.social_group, order: o }; };
  const deepMeta = (cov, note) => ({ ...metaBase, coverage: cov, note: (note ? note + " " : "") + imputNote });
  const DEEP = {
    "hces-states-imputed": [deep(byInd["1"].filter((r) => r.state !== "All India"), one, "inr", "With Imputation"),
      "States/UTs × rural/urban; average MPCE in ₹, with imputation (adds the value of food and goods received free through welfare schemes)."],
    "hces-fractiles-states": [deep(byInd["2"], frDim, "inr", "Without Imputation"),
      "All India and every state × rural/urban; average MPCE within each of the 12 fractile classes of that state's own spending ladder, ₹, without imputation.",
      "Each state's classes are cut on its own distribution, so the poorest 5% of Kerala and of Bihar are different people at different rupee levels. The survey publishes fractiles without imputation only."],
    "hces-categories-inr": [{ ...deep(byInd["3"].filter((r) => r.state === "All India"), catDim, "inr", "Without Imputation"),
      ...Object.fromEntries(Object.entries(deep(byInd["3"].filter((r) => r.state === "All India"), catDim, "inr", "With Imputation")).map(([k, v]) => [k + "__imputed", { ...v, name: v.name + "_imputed", label: v.label + " (with imputation)" }])) },
      "All India × rural/urban; MPCE in ₹ by broad item category (30-day recall), with and without imputation.",
      "Each rupee figure equals the category's share (hces-categories) times the MPCE, within rounding; both are published and both are baked."],
    "hces-categories-imputed": [deep(byInd["4"].filter((r) => r.state === "All India"), catDim, "pct_of_mpce", "With Imputation"),
      "All India × rural/urban; percentage share of MPCE by broad item category, with imputation."],
    "hces-categories-states-imputed": [deep(byInd["4"].filter((r) => r.state !== "All India"), catDim, "pct_of_mpce", "With Imputation"),
      "States/UTs × rural/urban; percentage share of MPCE by broad item category, with imputation."],
    "hces-categories-inr-states": [deep(ind3.filter((r) => r.state !== "All India"), catDim, "inr", "Without Imputation"),
      "States/UTs × rural/urban; MPCE in ₹ by broad item category (30-day recall), without imputation.", "In each state, sector and round, Food Total plus Non-Food Total equals that state's MPCE (hces-states) within 1%." + misNote],
    "hces-categories-inr-states-imputed": [deep(ind3.filter((r) => r.state !== "All India"), catDim, "inr", "With Imputation"),
      "States/UTs × rural/urban; MPCE in ₹ by broad item category (30-day recall), with imputation.", "In each state, sector and round, Food Total plus Non-Food Total equals that state's MPCE with imputation (hces-states-imputed) within 1%." + misNote],
    "hces-quantities-states": [deep(byInd["5"].filter((r) => r.state !== "All India"), cerDim, "kg_per_month", "Without Imputation"),
      "States/UTs × rural/urban; per-capita monthly quantity of cereals consumed, kg per person per month.", "Quantities are published without imputation only."],
    "hces-item-values-states": [{ ...deep(byInd["6"], cerDim, "inr", "Without Imputation"),
      ...Object.fromEntries(Object.entries(deep(byInd["6"], cerDim, "inr", "With Imputation")).map(([k, v]) => [k + "__imputed", { ...v, name: v.name + "_imputed", label: v.label + " (with imputation)" }])) },
      "All India and States/UTs × rural/urban; per-capita monthly value of cereals consumed, ₹, with and without imputation.",
      "With imputation adds the value of free grain from the public distribution system, which is why rice and wheat values rise most."],
    "hces-household-type-states": [{ ...deep(byInd["7"], htDim, "inr", "Without Imputation"),
      ...Object.fromEntries(Object.entries(deep(byInd["7"], htDim, "inr", "With Imputation")).map(([k, v]) => [k + "__imputed", { ...v, name: v.name + "_imputed", label: v.label + " (with imputation)" }])) },
      "All India and States/UTs × rural/urban; average MPCE by household type (how the household earns most of its living), ₹, with and without imputation.",
      "Rural types are published with an agriculture/non-agriculture split; urban types aggregated."],
    "hces-social-states": [{ ...deep(byInd["8"], sgDim, "inr", "Without Imputation"),
      ...Object.fromEntries(Object.entries(deep(byInd["8"], sgDim, "inr", "With Imputation")).map(([k, v]) => [k + "__imputed", { ...v, name: v.name + "_imputed", label: v.label + " (with imputation)" }])) },
      "All India and States/UTs × rural/urban; average MPCE by social group (ST, SC, OBC, others), ₹, with and without imputation.",
      "A small state's group averages rest on few households; the survey publishes them all and they are baked as published."],
    "hces-gini-states": [{ ...deep(byInd["9"].filter((r) => r.state !== "All India"), one, "gini", "Without Imputation"),
      ...Object.fromEntries(Object.entries(deep(byInd["9"].filter((r) => r.state !== "All India"), one, "gini", "With Imputation")).map(([k, v]) => [k + "__imputed", { ...v, name: v.name + "_imputed", label: v.label + " (with imputation)" }])) },
      "States/UTs × rural/urban; Gini coefficient of per-capita consumption expenditure, with and without imputation."],
  };
  // the full state category table, without imputation, joins the food-share bundle (its old
  // food-total keys stay as they were, for the page)
  const fullCatStates = deep(byInd["4"].filter((r) => r.state !== "All India" && r.item_category !== "Food Total"), catDim, "pct_of_mpce", "Without Imputation");
  Object.assign(foodStatesBundle.series, fullCatStates);
  foodStatesBundle.meta.coverage = "States/UTs × rural/urban; percentage share of MPCE by broad item category (30-day recall), without imputation. Keys <state>_<sector> are the Food Total share; <state>_<sector>__<category> every other category.";
  foodStatesBundle.meta.note = "Food Total plus Non-Food Total is 100 in every state and sector; the detail categories sum to their aggregate.";
  // the national rows the survey publishes with imputation join their bundles
  const addImputed = (bundle, rows, dimOf, unit) => {
    for (const [k, v] of Object.entries(deep(rows.filter((r) => r.state === "All India"), dimOf, unit, "With Imputation"))) {
      const key = k.replace(/^all_india_/, "") + "_imputed";
      bundle.series[key] = { ...v, name: `${v.name}_imputed`, label: `${v.label.replace(" · All India", "")} (with imputation)` };
      delete bundle.series[key].group;
    }
  };
  addImputed(itemValuesBundle, byInd["6"], cerDim, "inr");
  addImputed(hhTypeBundle, byInd["7"], htDim, "inr");
  addImputed(socialBundle, byInd["8"], sgDim, "inr");

  if (!mpceBundle.series.rural.data.some((v) => v != null)) throw new Error("HCES: no MPCE data returned");
  writeSeries(root, "data/series/hces-mpce.json", mpceBundle);
  writeSeries(root, "data/series/hces-states.json", statesBundle);
  writeSeries(root, "data/series/hces-fractiles.json", fractilesBundle);
  writeSeries(root, "data/series/hces-categories.json", categoriesBundle);
  writeSeries(root, "data/series/hces-gini.json", giniBundle);
  writeSeries(root, "data/series/hces-social.json", socialBundle);
  writeSeries(root, "data/series/hces-household-type.json", hhTypeBundle);
  writeSeries(root, "data/series/hces-quantities.json", quantitiesBundle);
  writeSeries(root, "data/series/hces-item-values.json", itemValuesBundle);
  writeSeries(root, "data/series/hces-categories-states.json", foodStatesBundle);
  for (const [slug, [series, cov, note]] of Object.entries(DEEP)) {
    if (Object.keys(series).length < 10) throw new Error(`HCES: ${slug} came out with ${Object.keys(series).length} series`);
    writeSeries(root, `data/series/${slug}.json`, { meta: deepMeta(cov, note), dates, series });
  }
  return mpceBundle;
}

/* Catalogue (docs/CONTRACT-coverage.md): hces/getHcesIndicatorList and
 * hces/getHcesFilterByIndicatorId. The imputation basis (with, without) is a different
 * measure, crossed with every cut: hces:<indicator>:<imputation>:all | :<dimension>:<value>. */
import { writeCatalogue, indicatorCatalogue, catalogueCli } from "../catalogue.mjs";
export async function catalogueHces() {
  const inds = (await mospi("hces/getHcesIndicatorList", {})).data ?? [];
  const items = await indicatorCatalogue({ mospi, prefix: "hces", indicators: inds, cross: ["imputation_type"],
    filter: (ind) => ["hces/getHcesFilterByIndicatorId", { indicator_code: ind.indicator_code }] });
  writeCatalogue("hces", { source: "MoSPI, NSO: Household Consumption Expenditure Survey (eSankhyiki API)",
    generator: "scripts/lib/products/hces.mjs --catalogue",
    note: "From getHcesIndicatorList and getHcesFilterByIndicatorId: one cut at a time, crossed with the imputation basis. Both survey years (2022-23, 2023-24) sit inside every item.", items });
}
await catalogueCli(import.meta.url, catalogueHces);
