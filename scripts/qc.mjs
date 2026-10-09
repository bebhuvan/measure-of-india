#!/usr/bin/env node
// scripts/qc.mjs — post-build checks, per docs/CONTRACT-render.md:
//  1. execute every page's JS against a jsdom DOM (catches syntax errors,
//     missing element ids, runtime exceptions);
//  2. no "–" placeholder left unfilled;
//  3. spot-check rendered numbers against data/series/*.json;
//  4. no smoothing curves in our code; tickFormat returns strings.
//
// Usage: node scripts/qc.mjs   (after astro build)

import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { pathToFileURL, fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";
import { DOSSIERS, bySlug } from "../src/dossiers/registry.js";
import * as fmt from "../src/charts/format.js";
import * as display from "../src/dossiers/display.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
// QC_DIST lets gate runs point at a scratch build (e.g. astro build
// --outDir /tmp/…) without touching the tracked dist/
const DIST = process.env.QC_DIST ? path.resolve(process.env.QC_DIST) : path.join(ROOT, "dist");
let failures = 0;
const fail = (m) => { failures++; console.error("FAIL:", m); };
const ok = (m) => console.log("  ok:", m);

const PAGES = [
  // titleblock and §01 lead with the 2024-base print; the 2012-base story
  // (§05 plate, core) stays below — both bundles are checked
  { url: "/guides/cpi/", slug: null, checks: [
    ["n-head", (b) => fmt.pct2(b["cpi-2024"].series.headline.data.at(-1))],
    ["n-food", (b) => fmt.pct2(b["cpi-2024"].series.food_and_beverages.data.at(-1))],
    ["n-old", (b) => fmt.pct2(b.cpi.series.headline.data.at(-1))],
    ["n-core", (b) => fmt.pct2(b.cpi.series.core.data.at(-1))],
    ["pv-nb", (b) => fmt.pct2(b["cpi-2024"].series.headline.data.at(-1))],
    ["nb-old-final", (b) => fmt.pct2(b.cpi.series.headline.data.at(-1))],
    ["ex-hjan", (b) => fmt.pct2(b.cpi.series.headline.data.at(-12))],
    ["prov-vintage", (b) => b.cpi.meta.vintage],
    ["prov-vintage24", (b) => b["cpi-2024"].meta.vintage],
    ["prov-vintage2", (b) => b["cpi-2024"].meta.vintage],
    // v2.4 — the 358-item ledger and the new-base state strip
    ["pv-tail24", (b) => {
      const vals = Object.values(b["cpi-2024-items"].series).map((s) => s.data.at(-1)).filter((v) => v != null);
      return fmt.pct2(Math.max(...vals));
    }],
    ["ex-t24neg", (b) => fmt.count(Object.values(b["cpi-2024-items"].series).map((s) => s.data.at(-1)).filter((v) => v != null && v < 0).length)],
    ["pv-st24", (b) => {
      const vals = Object.values(b["cpi-2024-states"].series).map((s) => s.data.at(-1)).filter((v) => v != null);
      return fmt.pt1(Math.max(...vals) - Math.min(...vals));
    }],
    ["pf-st24-ai", (b) => fmt.pct2(b["cpi-2024"].series.headline.data.at(-1))],
  ]},
  { url: "/guides/gdp/", slug: null, checks: [
    ["n-gdp", (b) => fmt.pct2(b["gdp-2022"].series.gdp.data.at(-1))],
    ["n-gfcf", (b) => fmt.pct2(b["gdp-2022"].series.gfcf.data.at(-1))],
    // v1.8 slots: engines, deflator wedge, saving rate, the 2022-23 base
    ["pv-ind", (b) => {
      const s = b["gdp-industries"].series;
      return fmt.pct2(Math.max(...Object.values(s).map((x) => x.data.at(-1))));
    }],
    ["ex-eng-agri", (b) => fmt.pct2(b["gdp-industries"].series.agriculture.data.at(-1))],
    ["pv-defl", (b) => fmt.pct2(b["gdp-nominal"].series.deflator.data.at(-1))],
    ["ex-defl-n", (b) => fmt.pct2(b["gdp-nominal"].series.gdp_nominal.data.at(-1))],
    ["ac-sav", (b) => fmt.pct1(b["gdp-accounts"].series.saving_rate.data.filter((v) => v != null).at(-1))],
    ["pv-nb", (b) => fmt.pct2(b["gdp-2022"].series.gdp.data.at(-1))],
    // 2022-23 base engines and the back series (2026-10)
    ["pv-nbind", (b) => fmt.pct2(Math.max(...Object.values(b["gdp-2022-industries"].series).map((s) => s.data.at(-1))))],
    ["pv-si", (b) => b["gdp-back"].series.saving_rate.data.filter((v) => v != null).at(-1).toFixed(1) + "%"],
    ["nb-q3", (b) => fmt.pct2(b["gdp-2022"].series.gdp.data.at(-2))],
    ["prov-vintage", (b) => b.gdp.meta.vintage],
  ]},
  { url: "/guides/wpi/", slug: null, checks: [
    // title strip and §02: the CURRENT base, 2022-23 (2011-12 ended Apr 2026)
    ["n-head", (b) => fmt.pct2(b["wpi-2022"].series.headline.data.at(-1))],
    ["n-fuel", (b) => fmt.pct2(b["wpi-2022"].series.fuel.data.at(-1))],
    ["pv-nb", (b) => fmt.pct2(b["wpi-2022"].series.headline.data.at(-1))],
    ["nb-new", (b) => fmt.pct2(b["wpi-2022"].series.headline.data.at(-1))],
    // the 697 items of the 2011-12 basket (plates from §10 stay on the old base)
    // v1.2 — the 697 items: hottest item, deflating-item count, onion's print
    ["pv-items", (b) => {
      const vals = Object.values(b["wpi-items"].series).map((s) => s.data.at(-1)).filter((v) => v != null);
      return fmt.pct2(Math.max(...vals));
    }],
    ["ex-ineg", (b) => fmt.count(Object.values(b["wpi-items"].series).map((s) => s.data.at(-1)).filter((v) => v != null && v < 0).length)],
    ["ex-ionion", (b) => {
      const v = b["wpi-items"].series.onion.data.at(-1);
      return fmt.pct1Minus(v);
    }],
    ["prov-vintage", (b) => b.wpi.meta.vintage],
  ]},
  { url: "/guides/iip/", slug: null, checks: [
    ["n-head", (b) => fmt.pct2(b["iip-2022"].series.general.data.at(-1))],
    ["n-cap", (b) => fmt.pct2(b["iip-2022"].series.use_capital_goods.data.at(-1))],
    // v1.2 deep-ledger plate: heritage bases 1993-94 / 2004-05
    ["pv-herit", (b) => {
      const v = Math.min(...b["iip-2004"].series.general.data.filter((x) => x != null));
      return fmt.pct2Minus(v);
    }],
    ["her-gfc93", (b) => {
      const g04 = b["iip-2004"].series.general.data;
      const i = g04.indexOf(Math.min(...g04.filter((x) => x != null)));
      const d = b["iip-2004"].dates[i];
      const j = b["iip-1993"].dates.indexOf(d);
      return fmt.pct2Plus(b["iip-1993"].series.general.data[j]);
    }],
    ["her-end93", (b) => fmt.pct2(b["iip-1993"].series.general.data.filter((x) => x != null).at(-1))],
    ["her-end04", (b) => fmt.pct2(b["iip-2004"].series.general.data.filter((x) => x != null).at(-1))],
    ["prov-vintage", (b) => b["iip-2022"].meta.vintage],
  ]},
  { url: "/guides/external/", slug: null, checks: [
    ["n-fx", (b) => fmt.inr2(b["rbi-forex"].series.usdinr.data.at(-1))],
    ["n-cad", (b) => fmt.pct1(b["rbi-bop-ratios"].series.cad_gdp.data.at(-1))],
    ["cr-res", (b) => fmt.bnRound(b["rbi-forex"].series.reserves.data.at(-1) / 1000)],
    // v1.2 plates — same formatter as the client (bn/bn2 on $bn values)
    ["pv-part", (b) => {
      const s = b["rbi-trade-partners"].series;
      const v = (s.exports_china.data.at(-1) - s.imports_china.data.at(-1)) / 1000;
      return fmt.bnFixed1(v);
    }],
    ["ex-pcm", (b) => {
      const v = b["rbi-trade-partners"].series.imports_china.data.at(-1) / 1000;
      return fmt.bnAuto(v);
    }],
    ["pv-comm", (b) => {
      const v = b["rbi-commodities-exports"].series.engineering_goods.data.at(-1) / 1000;
      return fmt.bnAuto(v);
    }],
    ["ex-cm1", (b) => {
      const v = b["rbi-commodities-imports"].series.petroleum_crude_products.data.at(-1) / 1000;
      return fmt.bnAuto(v);
    }],
    ["prov-vintage", (b) => b["rbi-forex"].meta.vintage],
  ]},
  { url: "/guides/jobs/", slug: null, checks: [
    ["n-ur", (b) => fmt.pct2(b["plfs-monthly"].series.ur.data.at(-1))],
    ["n-fur", (b) => fmt.pct2(b["plfs-cuts"].series.ur_female_urban.data.at(-1))],
    ["pv-main", (b) => fmt.pct2(b["plfs-quarterly"].series.ur.data.at(-1))],
    ["pv-annual", (b) => fmt.pct2(b["plfs-annual"].series.ur_psss.data.at(-1))],
    ["ex-p0", (b) => fmt.pct2(b["plfs-annual"].series.ur_psss.data[0])],
    // annual-report extras (v1.2): composition, earnings, education
    ["pv-status", (b) => fmt.pct1(b["plfs-status"].series.self_employed_person.data.at(-1))],
    ["ex-st-hp", (b) => fmt.pct1(b["plfs-status"].series.se_helper_person.data.at(-1))],
    ["pv-pay", (b) => fmt.inrR(b["plfs-earnings"].series.regular_person.data.filter((v) => v != null).at(-1))],
    ["ex-pay-sef", (b) => fmt.inrR(b["plfs-earnings"].series.self_employed_female.data.filter((v) => v != null).at(-1))],
    ["pv-casual", (b) => fmt.inrR(b["plfs-earnings"].series.casual_person.data.filter((v) => v != null).at(-1))],
    ["pv-edu", (b) => fmt.pct1(b["plfs-education"].series.graduate.data.at(-1))],
    ["ex-edu-y", (b) => fmt.pct1(b["plfs-education"].series.youth_15_29.data.at(-1))],
    ["prov-vintage", (b) => b["plfs-monthly"].meta.vintage],
    ["prov-vintage2", (b) => b["plfs-monthly"].meta.vintage],
  ]},
  { url: "/guides/consumption/", slug: null, checks: [
    ["n-rural", (b) => fmt.inrR(b["hces-mpce"].series.rural.data.at(-1))],
    ["n-urban", (b) => fmt.inrR(b["hces-mpce"].series.urban.data.at(-1))],
    ["n-gini", (b) => fmt.num3(b["hces-gini"].series.rural.data.at(-1))],
    ["pv-lad", (b) => fmt.inrR(b["hces-fractiles"].series.f95_100_urban.data.at(-1))],
    ["pv-social", (b) => fmt.x2(b["hces-social"].series.others_rural.data.at(-1) / b["hces-social"].series.st_rural.data.at(-1))],
    ["ex-so-scu", (b) => fmt.inrR(b["hces-social"].series.sc_urban.data.at(-1))],
    ["pv-hht", (b) => fmt.inrR(b["hces-household-type"].series.casual_labour_urban.data.at(-1))],
    ["pv-plate", (b) => fmt.kg2(b["hces-quantities"].series.total_cereals_rural.data.at(-1))],
    ["ex-q-rice", (b) => fmt.kg1(b["hces-quantities"].series.rice_rural.data.at(-1))],
    ["pv-food", (b) => {
      const s = b["hces-categories-states"].series;
      return fmt.pct2(Math.max(...Object.keys(s).filter((k) => k.endsWith("_rural")).map((k) => s[k].data.at(-1))));
    }],
    ["prov-vintage", (b) => b["hces-mpce"].meta.vintage],
    ["prov-vintage2", (b) => b["hces-mpce"].meta.vintage],
  ]},
  { url: "/guides/factories/", slug: null, checks: [
    ["n-fact", (b) => fmt.lakh2(b["asi-headline"].series.factories_in_operation.data.at(-1))],
    ["cr-fop", (b) => fmt.inr(b["asi-headline"].series.factories_in_operation.data.at(-1))],
    ["cr-gpwi", (b) => fmt.inrR(b["asuse-annual"].series.gva_per_worker_all.data.filter((v) => v != null).at(-1))],
    // v1.1 — the long century (four blocks, never joined)
    ["pv-long", (b) => {
      const l87 = b["asi-headline-1987"].series.number_of_factories.data.filter((v) => v != null).at(-1);
      const l08 = b["asi-headline"].series.number_of_factories.data.at(-1);
      return fmt.lakhN(l87) + " → " + fmt.lakhN(l08) + " lakh";
    }],
    ["ex-l02", (b) => fmt.inr(b["asi-headline-1998"].series.number_of_factories.data[3])],
    ["ex-lp03", (b) => fmt.croreN(b["asi-headline-1998"].series.persons_engaged.data.at(-1)) + " crore"],
    // v1.1 — the informal-firm portrait
    ["if-reg", (b) => fmt.inr(b["asuse-modernity"].series.reg_not_registered_combined.data.at(-1))],
    ["pv-modern", (b) => fmt.inr(b["asuse-modernity"].series.internet_all_combined.data.at(-1))],
    ["pv-owner", (b) => {
      const s = b["asuse-owners"].series;
      return fmt.inr(s.social_obc_combined.data.at(-1) + s.social_sc_combined.data.at(-1) + s.social_st_combined.data.at(-1)) + " / 1,000";
    }],
    ["ex-r-avg", (b) => fmt.num1(b["asuse-structure"].series.months_avg_combined.data.at(-1))],
    // v1.1 — the complete accounts ledger
    ["pv-acct", (b) => "₹" + fmt.num1(b["asi-accounts"].series.i19.data.at(-1) / 1e7) + " lakh cr"],
    ["ex-a-con", (b) => {
      const s = b["asi-accounts"].series;
      return fmt.pct1(s.i37.data.at(-1) / s.i32.data.at(-1) * 100);
    }],
    ["prov-vintage", (b) => b["asi-headline"].meta.vintage],
    ["prov-vintage2", (b) => b["asi-headline"].meta.vintage],
  ]},
  { url: "/guides/aishe/", slug: null, checks: [
    ["n-enrol", (b) => fmt.crore2(b["aishe-headline"].series.enrolment.data.at(-1))],
    ["n-ger", (b) => fmt.pct1(b["aishe-headline"].series.ger.data.at(-1))],
    ["n-gpi", (b) => fmt.num2(b["aishe-headline"].series.gpi.data.at(-1))],
    ["n-ptr", (b) => fmt.count(b["aishe-headline"].series.ptr.data.at(-1))],
    ["cr-enrol", (b) => fmt.inr(b["aishe-headline"].series.enrolment.data.at(-1))],
    ["pv-comp", (b) => fmt.pct0(b["aishe-composition"].series.under_graduate.data.at(-1) / b["aishe-headline"].series.enrolment.data.at(-1) * 100)],
    ["pv-enrol", (b) => {
      const e = b["aishe-headline"].series.enrolment.data;
      return fmt.pct0((e.at(-1) / e[0] - 1) * 100);
    }],
    ["pv-ger", (b) => fmt.pt1(b["aishe-access"].series.ger_all_both.data.at(-1) - b["aishe-access"].series.ger_st_both.data.at(-1))],
    ["pv-gergen", (b) => fmt.num2(b["aishe-headline"].series.gpi.data.at(-1))],
    ["pv-states", (b) => {
      const vals = Object.entries(b["aishe-states"].series).filter(([k]) => k.startsWith("ger_")).map(([, s]) => s.data.at(-1)).filter((v) => v != null);
      return fmt.pt0(Math.max(...vals) - Math.min(...vals));
    }],
    ["pv-edu", (b) => {
      const c = b["aishe-composition"].series.integrated.data;
      const g = (c.at(-1) / c[0] - 1) * 100;
      return (g >= 0 ? "+" : "") + fmt.pct0(g);
    }],
    ["pv-fac", (b) => {
      const t = b["aishe-teachers"].series;
      return fmt.pct0(t.professor_female.data.at(-1) / t.professor_both.data.at(-1) * 100);
    }],
    ["pv-min", (b) => fmt.inr(b["aishe-minority"].series.muslims_both.data.at(-1))],
    ["pv-ptr", (b) => fmt.count(b["aishe-headline"].series.ptr.data.at(-1))],
    // lecturers' share of the faculty ladder — regression test for the NaN
    // bug (denominator once summed datum objects, not values)
    ["ex-fac-lecn", (b) => {
      const t = b["aishe-teachers"].series;
      const li = t.lecturer_assistant_both.data.length - 1;
      const denom = t.professor_both.data[li] + t.reader_associate_both.data[li] + t.lecturer_assistant_both.data[li] + t.temporary_both.data[li] + t.demonstrator_both.data[li];
      return fmt.pct0((t.lecturer_assistant_both.data[li] / denom) * 100);
    }],
    ["prov-vintage", (b) => b["aishe-headline"].meta.vintage],
    ["prov-vintage2", (b) => b["aishe-headline"].meta.vintage],
  ]},
  { url: "/guides/gender/", slug: null, checks: [
    ["n-sr", (b) => b["gender-sexratio"].series.sex_ratio.data.at(-1) + "♀/1000♂"],
    ["n-lfpr", (b) => fmt.pct1(b["gender-work"].series.lfpr_female.data.at(-1))],
    ["n-mmr", (b) => fmt.count(b["gender-mmr"].series.mmr.data.at(-1))],
    ["cr-sr", (b) => String(b["gender-sexratio"].series.sex_ratio.data.at(-1))],
    ["cr-mmr", (b) => fmt.count(b["gender-mmr"].series.mmr.data.at(-1)) + "/100k"],
    ["cr-lit-f", (b) => fmt.pct1(b["gender-literacy"].series.literacy_female.data.at(-1))],
    ["cr-lfpr-f", (b) => fmt.pct1(b["gender-work"].series.lfpr_female.data.at(-1))],
    ["pv-sr", (b) => b["gender-sexratio"].series.sex_ratio.data[0] + " → " + b["gender-sexratio"].series.sex_ratio.data.at(-1)],
    ["pv-mmr", (b) => b["gender-mmr"].series.mmr.data[0] + " → " + fmt.count(b["gender-mmr"].series.mmr.data.at(-1))],
    ["pv-tfr", (b) => fmt.num2(b["gender-fertility"].series.tfr_graduate_and_above.data.at(-1))],
    ["pv-lfpr", (b) => fmt.pct1(b["gender-work"].series.lfpr_female.data.at(-1))],
    ["prov-vintage", (b) => b["gender-sexratio"].meta.vintage],
    ["prov-vintage2", (b) => b["gender-sexratio"].meta.vintage],
  ]},
  { url: "/guides/mnre/", slug: null, checks: [
    ["n-total", (b) => fmt.gw1(b["mnre-sources"].series.grand_total.data.at(-1))],
    ["n-solar-share", (b) => fmt.pct0(b["mnre-sources"].series.solar.data.at(-1) / b["mnre-sources"].series.grand_total.data.at(-1) * 100)],
    ["cr-total", (b) => fmt.gw1(b["mnre-sources"].series.grand_total.data.at(-1))],
    ["pv-total", (b) => fmt.num1(b["mnre-sources"].series.grand_total.data[0] / 1000) + " → " + fmt.num1(b["mnre-sources"].series.grand_total.data.at(-1) / 1000)],
    ["pv-sources", (b) => fmt.x1(b["mnre-sources"].series.solar.data.at(-1) / b["mnre-sources"].series.wind.data.at(-1))],
    ["pv-solar", (b) => fmt.pct0(b["mnre-solar-categories"].series.rooftop.data.at(-1) / b["mnre-sources"].series.solar.data.at(-1) * 100)],
    ["prov-vintage", (b) => b["mnre-sources"].meta.vintage],
    ["prov-vintage2", (b) => b["mnre-sources"].meta.vintage],
  ]},
  { url: "/guides/nfhs/", slug: null, checks: [
    ["n-anaemia", (b) => { const s = Object.values(b["nfhs-anaemia"].series).find((x) => x.label.includes("Children age 6-59")); return fmt.pct1(s.data[1]); }],
    ["n-imr", (b) => { const s = Object.values(b["nfhs-child"].series).find((x) => x.label.includes("Infant mortality")); return fmt.count(s.data[1]) + "/1000"; }],
    ["n-institutional", (b) => { const s = Object.values(b["nfhs-maternal"].series).find((x) => x.label.includes("Institutional births (in the 5 years")); return fmt.pct1(s.data[1]); }],
    ["n-tfr", (b) => { const s = Object.values(b["nfhs-fertility"].series).find((x) => x.label.includes("Total Fertility Rate")); return fmt.num2(s.data[1]); }],
    ["cr-anaemia", (b) => { const s = Object.values(b["nfhs-anaemia"].series).find((x) => x.label.includes("Children age 6-59")); return fmt.pct1(s.data[1]); }],
    ["pv-anaemia", (b) => { const s = Object.values(b["nfhs-anaemia"].series).find((x) => x.label.includes("Children age 6-59")); return fmt.pt1Plus(s.data[1] - s.data[0]); }],
    ["prov-vintage", (b) => b["nfhs-anaemia"].meta.vintage],
    ["prov-vintage2", (b) => b["nfhs-anaemia"].meta.vintage],
  ]},
  { url: "/guides/manufacturing/", slug: null, checks: [
    ["n-share", (b) => fmt.pct1(b["wdi-manufacturing"].series.mva_pct_gdp.data.at(-1))],
    ["n-level", (b) => fmt.bnRound(b["wdi-manufacturing"].series.mva_constant_usd.data.at(-1) / 1e9)],
    ["n-growth", (b) => fmt.pct1(b["wdi-manufacturing"].series.mva_growth.data.at(-1))],
    ["n-tech", (b) => fmt.pct1(b["wdi-manufacturing-tech"].series.medhi_tech_share.data.at(-1))],
    ["cr-share", (b) => fmt.pct1(b["wdi-manufacturing"].series.mva_pct_gdp.data.at(-1))],
    ["prov-vintage", (b) => b["wdi-manufacturing"].meta.vintage],
    ["prov-vintage2", (b) => b["wdi-manufacturing"].meta.vintage],
  ]},
  { url: "/guides/deposits/", slug: null, checks: [
    // the money figures: ₹ lakh crore, straight from the BSR-2 bundles
    ["cr-hh", (b) => fmt.lc1(b["deposits-owners"].series.household_total.data.at(-1))],
    ["pv-types", (b) => fmt.lc1(b["deposits-owners"].series.household_term.data.at(-1))],
    ["ex-ty-sav", (b) => fmt.lc1(b["deposits-owners"].series.household_savings.data.at(-1))],
    ["cr-term", (b) => fmt.pct1(100 * b["deposits-owners"].series.household_term.data.at(-1) / b["deposits-owners"].series.household_total.data.at(-1))],
    ["ex-p-women", (b) => fmt.pct1(100 * b["deposits-owners"].series.female_total.data.at(-1) / b["deposits-owners"].series.all_total.data.at(-1))],
    ["prov-vintage", (b) => b["deposits-owners"].meta.vintage],
  ]},
  // ---- services ----
  { url: "/guides/services/", slug: null, checks: [
    // title block: share of GVA (2022-23 base), annual services exports (RBI 807), service jobs (PLFS CY)
    ["n-share", (b) => fmt.pct1(b["services-gva-2022-share"].series.services.data.at(-1))],
    ["rb-share", (b) => fmt.pct1(b["services-gva-2022-share"].series.services.data.at(-1))],
    ["n-exp", (b) => "$" + Math.round(b["services-bop-annual"].series.s1_2_1_credit.data.at(-1) / 1000) + " bn"],
    ["n-jobs", (b) => fmt.pct1(b["services-jobs-cy"].series.tertiary__person_all_cws.data.at(-1))],
    ["rb-side", (b) => fmt.bnAuto(b["services-trade-monthly"].series.exports.data.at(-1))],
    ["pv-long", (b) => fmt.pct1(b["services-gva-2022-share"].series.services.data.at(-1))],
    ["pv-quarter", (b) => fmt.pct2(b["gdp-2022-industries"].series.finance_realty.data.at(-1))],
    ["ex-mo-exp", (b) => fmt.bnFixed1(b["services-trade-monthly"].series.exports.data.at(-1))],
    ["ex-mo-imp", (b) => fmt.bnFixed1(b["services-trade-monthly"].series.imports.data.at(-1))],
    ["ex-tl-sw", (b) => fmt.bnAuto(b["services-bop-annual"].series.s1_2_1_5_1_credit.data.at(-1) / 1000)],
    ["pv-isp", (b) => { const v = Object.values(b["services-isp-growth"].series).map((s) => s.data.at(-1)).filter((x) => x != null); return `${v.filter((x) => x >= 10).length} of ${v.length}`; }],
    ["pv-ispa", (b) => fmt.pct1(Math.max(...Object.values(b["services-isp-annual"].series).map((s) => s.data.at(-1))) - 100)],
    ["pv-status", (b) => fmt.pct1(b["services-jobs-ay"].series.regular__tertiary__person_all_ps.data.at(-1))],
    ["pv-agva", (b) => "₹" + fmt.inr(b["services-asuse"].series.gva_per_worker__other_services_group__combined__all.data.at(-1))],
    ["prov-vintage", (b) => b["services-gva-2022-share"].meta.vintage],
  ]},
  // ---- end services ----
  { url: "/", slug: null, minPlots: 1, checks: [
    // the CPI print is the 2024-base series; core stays on the 2012 base
    // (no weights served for the new base), labelled "to Dec 2025"
    ["v-cpi", (b) => fmt.pct2(b["cpi-2024"].series.headline.data.at(-1)), "cpi-2024"],
    // the GDP print is the 2022-23-base series (old base ends Q2 FY26)
    ["v-gdp", (b) => fmt.pct2(b["gdp-2022"].series.gdp.data.at(-1)), "gdp-2022"],
  ]},
  // the guides index: one small chart per guide
  { url: "/guides/", slug: null, minPlots: 13, checks: [] },
  { url: "/register/", slug: null, minPlots: 8, checks: [] },
  { url: "/learn/inflation/", slug: "cpi", minPlots: 3, checks: [
    ["lr-rdec", (b) => fmt.pct2(b.series.headline.data.at(-1))],
    ["lr-rjan", (b) => fmt.pct2(b.series.headline.data.at(-12))],
  ]},
  { url: "/learn/", slug: null, minPlots: 0, checks: [] },
  // learn section: every page marked live in src/learn/registry.js
  ...(await import(pathToFileURL(path.join(ROOT, "src/learn/registry.js")).href)).EXPLAINERS
    .filter((e) => e.live && e.slug !== "inflation")
    .map((e) => ({
      url: `/learn/${e.slug}/`,
      slug: ["base-effects","index-weights","core-inflation","yoy-and-mom","seasonality","inflation-targeting","index-numbers","noise-and-trend","monsoon-and-food-prices"].includes(e.slug) ? "cpi" : "gdp",
      minPlots: { "base-effects": 2, "real-vs-nominal": 0, revisions: 0, "per-capita": 0, "base-year": 0, "stocks-and-flows": 0, "averages-and-distribution": 0 }[e.slug] ?? 1,
      checks: [],
    })),
];

// startup guard: the PAGES table and the dossier registry must cover each
// other exactly — a new dossier must be impossible to ship un-gated
{
  const gated = PAGES.filter((p) => p.url.startsWith("/guides/") && p.url !== "/guides/").map((p) => p.url.split("/")[2]);
  const ungated = DOSSIERS.map((d) => d.slug).filter((s) => !gated.includes(s));
  const unknown = gated.filter((s) => !bySlug[s]);
  if (ungated.length || unknown.length) {
    if (ungated.length) console.error(`qc: registry dossiers with no PAGES entry: ${ungated.map((s) => "/guides/" + s + "/").join(", ")}`);
    if (unknown.length) console.error(`qc: PAGES dossier URLs not in the registry: ${unknown.join(", ")}`);
    process.exit(1);
  }
}

// numbers match the baked data — bundles load lazily on first touch; a
// missing file fails the gate naming the file, never an uncaught ENOENT
const bundleCache = {};
const bundles = new Proxy({}, {
  get: (_, slug) => {
    if (typeof slug !== "string") return undefined;
    if (!(slug in bundleCache)) {
      const file = path.join(ROOT, "data/series", slug + ".json");
      if (!fs.existsSync(file)) throw new Error(`bundle file missing: ${path.relative(ROOT, file)}`);
      bundleCache[slug] = JSON.parse(fs.readFileSync(file, "utf8"));
    }
    return bundleCache[slug];
  },
});

for (const page of PAGES) {
  const file = path.join(DIST, page.url, "index.html");
  if (!fs.existsSync(file)) { fail(`${page.url}: not built`); continue; }
  const html = fs.readFileSync(file, "utf8");

  // every id referenced by inline HTML placeholders exists — and vice versa
  const dash = [...html.matchAll(/id="([a-z0-9-]+)">–</g)].map((m) => m[1]);

  const dom = new JSDOM(html, { url: "https://atlas.thisindianlife.today" + page.url, pretendToBeVisual: true });
  const { window } = dom;
  window.URL.createObjectURL = () => "blob:x";
  window.URL.revokeObjectURL = () => {};
  window.HTMLCanvasElement.prototype.getContext = () => null;
  for (const k of ["window", "document", "Node", "Element", "HTMLElement", "SVGElement", "XMLSerializer", "Image", "Blob", "CustomEvent", "Event", "getComputedStyle"]) {
    try { Object.defineProperty(globalThis, k, { value: window[k] ?? globalThis[k], configurable: true, writable: true }); } catch {}
  }
  globalThis.window = window;
  globalThis.document = window.document;

  // evaluate the page's module scripts (they import shared chunks from _astro)
  const scripts = [...html.matchAll(/<script[^>]+src="([^"]+\.js)"/g)].map((m) => m[1]);
  const inline = [...html.matchAll(/<script type="module">([^<]+)<\/script>/g)].map((m) => m[1]).join("\n");
  try {
    for (const src of scripts) {
      const p = path.join(DIST, src);
      await import(pathToFileURL(p).href);
    }
    if (inline.trim()) {
      const blob = new Blob([inline], { type: "text/javascript" });
      // inline module scripts are already executed via imports above in Astro output;
    }
  } catch (e) {
    fail(`${page.url}: script threw — ${e.message}`);
  }

  const doc = window.document;
  // placeholders must all be filled now
  const left = dash.filter((id) => doc.getElementById(id)?.textContent.trim() === "–");
  if (left.length) fail(`${page.url}: unfilled placeholders: ${left.join(", ")}`);
  else ok(`${page.url}: all ${dash.length} figure slots filled`);

  // runtime-computed NaN/undefined must never reach the reader (the static
  // sweep above can't see JS-injected text; this one executes the page)
  const badTok = doc.body.textContent.match(/\b(NaN|undefined|Infinity)\b/);
  if (badTok) fail(`${page.url}: renders "${badTok[1]}" as page text (check client arithmetic)`);
  else ok(`${page.url}: no NaN/undefined/Infinity in rendered text`);

  // numbers match the baked data
  for (const [id, fn, which] of page.checks) {
    const got = doc.getElementById(id)?.textContent.trim();
    let want;
    try {
      want = fn(page.slug ? bundles[page.slug] : bundles);
    } catch (e) {
      fail(`${page.url} #${id}: ${e.message}`);
      continue;
    }
    if (got !== want) fail(`${page.url} #${id}: rendered "${got}" != data "${want}"`);
    else ok(`${page.url} #${id} = ${want}`);
  }

  // titleblock stamp and register vintage labels are DERIVED from the bundles
  // (src/dossiers/display.js) — a hand-typed or stale stamp fails here
  if (page.url.startsWith("/guides/") && page.url !== "/guides/") {
    const d = bySlug[page.url.split("/")[2]];
    const got = doc.querySelector(".sh-date")?.textContent.trim();
    const want = display.dateStamp(d);
    if (got !== want) fail(`${page.url}: titleblock stamp "${got}" != derived "${want}" (src/dossiers/display.js)`);
  }
  if (page.url === "/") {
    // rows are ordered by release date, so match each guide's row by its slug, not its position
    DOSSIERS.forEach((d) => {
      const got = doc.querySelector(`.dossiers [data-slug="${d.slug}"] .vt`)?.textContent.trim();
      const want = display.vintageLabel(d);
      if (got !== want) fail("/: dossier row " + d.slug + " vintage label '" + got + "' != derived '" + want + "'");
    });
  }
  if (page.url === "/register/") {
    const got = doc.querySelector(".sh-date")?.textContent.trim();
    const want = display.dateStamp(bySlug.cpi);
    if (got !== want) fail(`${page.url}: register stamp "${got}" != derived "${want}"`);
  }

  // learn pages: level figures trace to the published index levels
  if (page.url === "/learn/inflation/") {
    const lv = JSON.parse(fs.readFileSync(path.join(ROOT, "data/raw/cpi-indices.json"), "utf8")).levels;
    const want = fmt.num1(lv["combined:general"]["2025-12"]);
    const got = doc.getElementById("n-lvl-now")?.textContent.trim();
    if (got !== want) fail(`${page.url} #n-lvl-now: rendered "${got}" != data "${want}"`);
    else ok(`${page.url} #n-lvl-now = ${want}`);
  }
  const minPlots = page.minPlots ?? 4;
  const nPlots = doc.querySelectorAll(".plotzone svg, #frontis-plot svg, .spark svg, .nspark svg").length;
  if (nPlots < minPlots) fail(`${page.url}: expected >=${minPlots} SVGs, got ${nPlots}`);
  else ok(`${page.url}: ${nPlots} charts rendered`);

  // download card composition: title + source + brand, valid SVG
  if (page.url === "/guides/cpi/") {
    const { composeCardSVG } = await import(pathToFileURL(path.join(ROOT, "src/charts/plumbing.js")).href);
    const raw = doc.querySelector("#plot-main svg");
    const card = composeCardSVG(raw, {
      title: doc.querySelector("#cb-main .plate-head h3").textContent.trim(),
      sub: doc.querySelector("#cb-main .plate-head .sub").textContent.trim(),
      foot: doc.querySelector("#cb-main .plotfoot .src").textContent.trim().replace(/\s+/g, " "),
    });
    const parsed = new window.DOMParser().parseFromString(card.svg, "image/svg+xml");
    const text = parsed.documentElement.textContent;
    if (parsed.querySelector("parsererror")) fail("download card: SVG does not parse");
    else {
      // v2 card: sentence-case source line, brand set as "India Atlas" plus the address
      for (const needle of ["cost of living", "MoSPI", "India Atlas", "atlas.thisindianlife.today"]) {
        if (!text.includes(needle)) fail(`download card: missing "${needle}"`);
      }
      ok(`download card composes (${card.width}×${card.height}, ${ (card.svg.length/1024).toFixed(0) } KB svg)`);
    }
  }
  // small-multiple grid panels are decorative (aria-hidden) — their accessible
  // name lives on the grid container's aria-label, so they carry no <title>
  const missingTitle = [...doc.querySelectorAll(".plotzone svg")]
    .filter((s) => !s.querySelector("title") && s.getAttribute("aria-hidden") !== "true");
  if (missingTitle.length) fail(`${page.url}: ${missingTitle.length} plates missing <title>`);
}

// static greps over our own sources (not Plot internals) — the file list is
// the registry's, so a new dossier's client module is linted from day one
import { DOSSIERS as QC_DOSSIERS } from "../src/dossiers/registry.js";
for (const f of [...QC_DOSSIERS.map((d) => `src/dossiers/${d.slug}.client.js`), "src/charts/plumbing.js"]) {
  const src = fs.readFileSync(path.join(ROOT, f), "utf8");
  if (/curve\s*[:=]|catmull|monotone|basis/.test(src.replace(/monetary/g, ""))) fail(`${f}: smoothing curve reference found`);
  for (const m of src.matchAll(/tickFormat:\s*\([^)]*\)\s*=>\s*([^,}\n]+)/g)) {
    // fail only when nothing in the body can produce a string — string
    // literals, String(), toFixed/toLocaleString and lookup tables are legal
    if (!/["'`]|String\(|toFixed|toLocaleString|\w+\[/.test(m[1])) fail(`${f}: tickFormat may not return a string — ${m[0]}`);
  }
  // area washes must declare their baseline: an implicit y1=0 bleeds below
  // the plot on any domain that excludes zero (overflow:"visible" never clips)
  for (const m of src.matchAll(/Plot\.areaY\(([^)]|\([^)]*\))*\}\)/g)) {
    if (!/y1\s*:/.test(m[0])) fail(`${f}: areaY without an explicit baseline (y1) — anchor at 0 only when the domain includes it`);
  }
}
ok("static source greps done");

// ---------------------------------------------------------------------------
// Prose gates (AGENTS.md rule 3, enforced post-build):
//  1. no placeholder prose may ship — "(dated prose pending — run: …)" in a
//     built page is a release blocker, not a cosmetic wart;
//  2. freshness — every dated slot recorded in pipeline/out/prose-manifest.json
//     must describe the print the CURRENT bundle serves. If a release lands and
//     prose regeneration failed or was skipped, the periods diverge and the
//     build fails here. Formatting-proof: compares ISO dates, never rendered
//     strings.
// ---------------------------------------------------------------------------
{
  const htmlFiles = [];
  (function walk(dir) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name.endsWith(".html")) htmlFiles.push(p);
    }
  })(DIST);
  const pend = [...new Set(htmlFiles.filter((p) => /\(dated prose pending[^)]*\)/.test(fs.readFileSync(p, "utf8"))))];
  for (const p of pend) fail(`placeholder prose shipped: ${path.relative(DIST, p)}`);
  if (!pend.length) ok("no placeholder prose in dist");

  // no NaN/undefined ever renders as page text (numbers are computed before
  // build gates run; this catches the arithmetic the per-id checks miss)
  const nanPages = htmlFiles.filter((p) => />[^<]*\bNaN\b|>[^<]*\bundefined\b/.test(fs.readFileSync(p, "utf8")));
  for (const p of nanPages) fail(`NaN/undefined rendered in ${path.relative(DIST, p)}`);
  if (!nanPages.length) ok("no NaN/undefined in rendered HTML");

  // placeholder contact addresses can never ship (and the corrections
  // mailbox was removed by decision — any stray register@ line is a bug)
  const exampleMail = htmlFiles.filter((p) => /indiaatlas\.example|register@|\b[A-Za-z0-9._%+-]+@example\./.test(fs.readFileSync(p, "utf8")));
  for (const p of exampleMail) fail(`stray contact email in ${path.relative(DIST, p)}`);
  if (!exampleMail.length) ok("no stray contact email in dist");

  const manifestPath = path.join(ROOT, "pipeline/out/prose-manifest.json");
  if (!fs.existsSync(manifestPath)) {
    fail("prose-manifest.json missing — run `npm run prose` once to seed it");
  } else {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
    let checked = 0;
    const bundleCache = {};
    const loadBundle = (slug) => bundleCache[slug] ??= JSON.parse(fs.readFileSync(path.join(ROOT, "data/series", slug + ".json"), "utf8"));
    for (const [slot, rec] of Object.entries(manifest)) {
      const proseFile = path.join(ROOT, "pipeline/out", `prose-${slot}.md`);
      if (!fs.existsSync(proseFile)) { fail(`manifest lists ${slot} but prose file is gone`); continue; }
      const current = loadBundle(rec.bundle);
      if (current.dates.at(-1) !== rec.latestDate) {
        fail(`stale prose: ${slot} describes ${rec.latestDate} but the bundle now serves ${current.dates.at(-1)} — run \`npm run prose\``);
      } else {
        checked++;
        // the emitted prose must still satisfy its slot contract — sentence
        // ceilings, required figures, and the coverage floors of slots.yml
        const [pslug, ...rest] = slot.split(".");
        try {
          execFileSync(process.execPath, [path.join(ROOT, "pipeline/contract.mjs"), proseFile, pslug, rest.join(".")], { stdio: "pipe" });
        } catch (e) {
          fail(`coverage contract: ${slot} — ${((e.stdout?.toString() ?? "") + (e.stderr?.toString() ?? "")).trim()}`);
        }
      }
    }
    if (checked) ok(`prose fresh: ${checked}/${Object.keys(manifest).length} dated slots describe the current print`);
  }
}

if (failures) { console.error(`\n${failures} QC failure(s)`); process.exit(1); }
console.log("\nQC: all checks passed");
