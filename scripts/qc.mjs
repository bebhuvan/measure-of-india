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
import * as PF from "../src/dossiers/payments.fmt.js";   // payments (lb/payments): the guide's own renderers

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
// QC_DIST lets gate runs point at a scratch build (e.g. astro build
// --outDir /tmp/…) without touching the tracked dist/
const DIST = process.env.QC_DIST ? path.resolve(process.env.QC_DIST) : path.join(ROOT, "dist");
let failures = 0;
const fail = (m) => { failures++; console.error("FAIL:", m); };
const ok = (m) => console.log("  ok:", m);

// health-gender: an NFHS value (All India, total unless named) and a round's states, by sub-indicator
const nfhsV = (b, round, table, re, geo = "All India", sector = "total") => Object.values(b[`nfhs-${round}-${table}`].series).find((s) => re.test(s.group) && s.geo === geo && s.sector === sector).data[0];
const nfhsStates = (b, round, table, re) => Object.values(b[`nfhs-${round}-${table}`].series).filter((s) => re.test(s.group) && s.sector === "total" && s.geo !== "All India").map((s) => ({ geo: s.geo, v: s.data[0] }));
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
    // ---- prices wave 2 (lb/prices): CPI-IW, rural wages, state x division, the 2012 groups and items
    ["pv-iw", (b) => fmt.pct2(b["cpiiw-2016"].series.general.data.at(-1))],
    ["iw-yago", (b) => fmt.pct2(b["cpiiw-2016"].series.general.data.at(-13))],
    ["iwg-food", (b) => fmt.pct2(b["cpiiw-2016"].series.food.data.at(-1))],
    ["iwc-n", (b) => fmt.count(Object.values(b["cpiiw-centres-2016"].series).filter((s) => s.data.at(-1) != null).length)],
    ["iwc-ai", (b) => fmt.pct2(b["cpiiw-2016"].series.general.data.at(-1))],
    ["pv-wage", (b) => fmt.inrR(b["wages-rural-2013"].series.o1210.data.filter((v) => v != null).at(-1))],
    ["wgs-ai", (b) => fmt.inrR(b["wages-rural-2013"].series.o1210.data.filter((v) => v != null).at(-1))],
    ["stdiv-cells", (b) => fmt.count(Object.values(b["cpi-2024-states-divisions"].series).filter((s) => s.data.at(-1) != null).length)],
    ["oth-misc", (b) => fmt.pct2(b["cpi-groups"].series.miscellaneous.data.at(-1))],
    ["oth-housing", (b) => fmt.pct2(b["cpi-groups"].series.housing.data.at(-1))],
    ["pv-items12", (b) => Math.max(...Object.values(b["cpi-items-2012"].series).map((s) => s.latest_level).filter((v) => v != null)).toFixed(1)],
    ["it12-below", (b) => { const n = Object.values(b["cpi-items-2012"].series).filter((s) => s.latest_level != null && s.latest_level < 100).length; return n === 1 ? "only one item was" : fmt.count(n) + " items were"; }],
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
    // ---- nas (wave 2): the deep accounts' plates ----
    ["pv-spend", (b) => fmt.pct1Minus(b["gdp-2022-annual-shares"].series.pfce.data.filter((v) => v != null).at(-1))],
    ["pv-disc", (b) => fmt.pct1Minus(b["gdp-2022-quarterly-shares"].series.discrepancy.data.at(-1))],
    ["pv-sect", (b) => { const S = b["gdp-2022-sectors"].series, i = S.saving_households_pct_gdp.data.findLastIndex((v) => v != null); return fmt.pct1Minus(S.saving_households_pct_gdp.data[i] - S.gfcf_households_pct_gdp.data[i]); }],
    ["pv-hh", (b) => fmt.pct1Minus(b["gdp-2022-sectors"].series.saving_households_pct_gdp.data.filter((v) => v != null).at(-1))],
    ["pv-make", (b) => fmt.pct1Minus(b["gdp-2022-annual-industries"].series.agriculture_share.data.filter((v) => v != null).at(-1))],
    // ---- end nas ----
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
    // ---- prices wave 2 (lb/prices): four bases, wholesale to retail
    ["pv-long", (b) => fmt.pct2(b["wpi-2022"].series.headline.data.at(-1))],
    ["long-now", (b) => fmt.pct2(b["wpi-2022"].series.headline.data.at(-1))],
    ["w2r-n", (b) => { const c = new Map(b.cpi.dates.map((d, i) => [d, b.cpi.series.food.data[i]])); return fmt.count(b.wpi.dates.filter((d, i) => b.wpi.series.food_index.data[i] != null && c.get(d) != null).length); }],
  ]},
  { url: "/guides/iip/", slug: null, checks: [
    // industry (wave 2): financial years, the core eight
    ["pv-fy", (b) => fmt.pct2Minus(b["iip-annual-2022"].series.general_growth.data.at(-1))],
    ["pv-core", (b) => fmt.pct2Minus(b["core-2011"].series.composite_growth.data.at(-1))],
    ["pv-corelong", (b) => fmt.pct2Minus(b["core-2011"].series.composite_growth.data[b["core-2011"].dates.indexOf("2020-04-01")])],
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
  // external (lb/external, 2026-10): RBI DBIE bundles; amounts US$ million shown in US$ bn
  { url: "/guides/external/", slug: null, checks: [
    ["n-ca", (b) => fmt.bnFixed1(b["external-bop"].series.current_account.data.at(-1) / 1000)],
    ["pv-ca", (b) => fmt.bnFixed1(b["external-bop"].series.current_account.data.at(-1) / 1000)],
    ["n-res", (b) => fmt.bnRound(b["external-reserves-weekly"].series.total_usd.data.at(-1) / 1000)],
    ["n-inr", (b) => fmt.inr2(b["external-rupee"].series.usd.data.at(-1))],
    ["n-reer", (b) => fmt.num1(b["external-reer-2015"].series.reer_trade.data.at(-1))],
    ["pv-cagdp", (b) => fmt.pct1Minus(b["external-bop-indicators"].series.cad_to_gdp.data.at(-1))],
    ["ex-p-goods", (b) => fmt.bnFixed1(b["external-bop"].series.goods.data.at(-1) / 1000)],
    ["ex-p-rem", (b) => fmt.bnFixed1(b["external-bop"].series.private_transfers.data.at(-1) / 1000)],
    ["pv-remit", (b) => fmt.bnFixed1(b["external-bop-gross"].series.remittances_in.data.at(-1) / 1000)],
    ["ex-f-fdi", (b) => fmt.bnFixed1(b["external-bop"].series.fdi.data.at(-1) / 1000)],
    ["ex-res-cover", (b) => fmt.num1(b["external-bop-indicators"].series.import_cover_of_reserves_in_months.data.at(-1))],
    ["pv-debt", (b) => fmt.bnRound(b["external-debt-annual"].series.e_1_gross_external_debt_position.data.at(-1) / 1000)],
    ["ex-debt-st", (b) => fmt.pct1(b["external-debt-annual"].series.e_5_as_of_total_debt.data.at(-1))],
    ["pv-iip", (b) => fmt.bnFixed1(b["external-iip-head"].series.net.data.at(-1) / 1000)],
    ["pv-desk", (b) => fmt.bnFixed1(b["external-intervention"].series.forward_outstanding.data.at(-1) / 1000)],
    ["prov-vintage", (b) => b["external-bop"].meta.vintage],
  ]},
  { url: "/guides/jobs/", slug: null, checks: [
    ["n-ur", (b) => fmt.pct2(b["plfs-monthly"].series.ur.data.at(-1))],
    ["n-fur", (b) => fmt.pct2(b["plfs-cuts"].series.ur_female_urban.data.at(-1))],
    // jobs-deep: plate 1 shows the revamped design's urban rate; the new plates' headline values
    ["pv-main", (b) => fmt.pct1(b["plfs-q25"].series.ur_cws__person_urban__a15plus.data.at(-1))],
    ["ex-q1", (b) => fmt.pct2(b["plfs-quarterly"].series.ur.data.filter((v) => v != null).at(-1))],
    ["pv-seam", (b) => fmt.pct1(b["plfs-cy25-india"].series.lfpr_psss__person_all__a15plus.data.at(-1))],
    ["pv-q25", (b) => fmt.pct1(b["plfs-q25"].series.ur_cws__person_all__a15plus.data.at(-1))],
    ["ex-q25r", (b) => fmt.pct1(b["plfs-q25"].series.ur_cws__person_rural__a15plus.data.at(-1))],
    ["pv-ystates", (b) => fmt.pct1(b["plfs-q25"].series.ur_cws__person_all__a15_29.data.at(-1))],
    ["pv-youth", (b) => fmt.pct1(b["plfs-monthly-age"].series.ur_cws__female_urban__a15_29.data.at(-1))],
    ["pv-paystates", (b) => fmt.inrR(b["plfs-cy25-earnings"].series.regular__person_all.data.at(-1))],
    ["ex-ps-f", (b) => fmt.inrR(b["plfs-cy25-earnings"].series.regular__female_all.data.at(-1))],
    ["pv-cond", (b) => fmt.pct1(b["plfs-conditions"].series.none_of_three__person_all.data.at(-1))],
    ["ex-c-nc0", (b) => fmt.pct1(b["plfs-conditions"].series.no_contract__person_all.data[0])],
    ["pv-social", (b) => fmt.pct1(b["plfs-cy25-india"].series.lfpr_psss__female_all__a15plus.data.at(-1))],
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
    // households wave 2: what free items add, and inequality by state
    ["pv-impute", (b) => "₹" + fmt.inr(b["hces-mpce"].series.rural_imputed.data.at(-1) - b["hces-mpce"].series.rural.data.at(-1))],
    ["pv-ginist", (b) => { const s = b["hces-gini-states"].series; const r = Object.keys(s).filter((k) => k.endsWith("_rural")).filter((k) => s[k.replace(/_rural$/, "_urban")]); return `${r.filter((k) => s[k.replace(/_rural$/, "_urban")].data.at(-1) > s[k].data.at(-1)).length} of ${r.length}`; }],
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
    // industry (wave 2): wages and plant size by industry, the 2025 ASUSE round
    ["pv-wage", (b) => { const s = b["asi-headline"].series; return "₹" + fmt.num1(s.emoluments.data.at(-1) * 1e5 / s.persons_engaged.data.at(-1) / 1e5) + " lakh"; }],
    ["pv-size", (b) => { const s = b["asi-headline"].series; return fmt.count(s.persons_engaged.data.at(-1) / s.factories_in_operation.data.at(-1)); }],
    ["pv-trades", (b) => fmt.croreN(b["asuse-2025-t26"].series.all__all.data[0])],
    ["pv-women", (b) => { const s = b["asuse-2025-t26"].series; return fmt.pct1(100 * s.female__all.data[0] / s.all__all.data[0]); }],
  ]},
  { url: "/guides/aishe/", slug: null, checks: [
    ["n-enrol", (b) => fmt.crore2(b["aishe-headline"].series.enrolment.data.at(-1))],
    ["n-ger", (b) => fmt.pct1(b["aishe-headline"].series.ger.data.at(-1))],
    ["n-gpi", (b) => fmt.num2(b["aishe-headline"].series.gpi.data.at(-1))],
    ["n-ptr", (b) => fmt.count(b["aishe-headline"].series.ptr.data.at(-1))],
    // counts in words a reader can hold (aishe.client.js countWords): crore, lakh, else digits
    ["cr-enrol", (b) => { const v = b["aishe-headline"].series.enrolment.data.at(-1); return v >= 1e7 ? (v / 1e7).toFixed(2) + " crore" : v >= 1e5 ? (v / 1e5).toFixed(1) + " lakh" : fmt.inr(v); }],
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
    ["pv-min", (b) => { const v = b["aishe-minority"].series.muslims_both.data.at(-1); return v >= 1e7 ? (v / 1e7).toFixed(2) + " crore" : v >= 1e5 ? (v / 1e5).toFixed(1) + " lakh" : fmt.inr(v); }],
    ["pv-ptr", (b) => fmt.count(b["aishe-headline"].series.ptr.data.at(-1))],
    // lecturers' share of the faculty ladder — regression test for the NaN
    // bug (denominator once summed datum objects, not values)
    ["ex-fac-lecn", (b) => {
      const t = b["aishe-teachers"].series;
      const li = t.lecturer_assistant_both.data.length - 1;
      // of all teachers, the published total (households wave 2: the six posts add up to it)
      return fmt.pct0((t.lecturer_assistant_both.data[li] / t.all_both.data[li]) * 100);
    }],
    // households wave 2: the state plates
    ["pv-stptr", (b) => fmt.count(Math.max(...Object.entries(b["aishe-ptr"].series).filter(([k]) => k.endsWith("__ptr_regular_all") && !k.startsWith("all_india")).map(([, s]) => s.data.at(-1)).filter((v) => v != null)))],
    ["pv-stwomen", (b) => fmt.pct0(100 * b["aishe-states-teachers"].series.all_india__all_female.data.at(-1) / b["aishe-states-teachers"].series.all_india__all_both.data.at(-1))],
    ["pv-stcol", (b) => fmt.inr(b["aishe-states-institutions"].series.all_india__colleges.data.at(-1))],
    ["prov-vintage", (b) => b["aishe-headline"].meta.vintage],
    ["prov-vintage2", (b) => b["aishe-headline"].meta.vintage],
  ]},
  // health-gender: the compendium's tables, read straight from their bundles
  { url: "/guides/gender/", slug: null, minPlots: 18, checks: [
    ["n-srb", (b) => fmt.count(b["gender-t007"].series.total__all_india.data.at(-1))],
    ["rb-srb", (b) => fmt.count(b["gender-t007"].series.total__all_india.data.at(-1))],
    ["rb-srb-then", (b) => fmt.count(b["gender-t007"].series.total__all_india.data[0])],
    ["n-lfpr", (b) => fmt.pct1(b["gender-t082-cy25"].series.total__female__all_india.data.at(-1))],
    ["n-ls", (b) => { const c = b["gender-t124"].series.elected_female__all_india__count.data, s = b["gender-t124"].series.number_of_seats_available_for_election__all_india.data; return fmt.pct1(Math.round(1000 * c.at(-1) / s.at(-1)) / 10); }],
    ["n-time", (b) => fmt.count(b["gender-t104"].series.average_time_in_minutes_spent_in_a_day_per_person__female__unpaid_activity__all_india.data.at(-1))],
    ["pv-mmr", (b) => fmt.count(b["gender-t021"].series.all_india.data.at(-1))],
    ["pv-imr", (b) => fmt.count(b["gender-t015"].series.female__all_india.data.at(-1))],
    ["pv-crime", (b) => fmt.num1(b["gender-t141"].series.rates_of_crimes__total_crimes_against_women__all_india.data.at(-1))],
    ["pv-lfpr", (b) => fmt.pct1(b["gender-t082-cy25"].series.total__female__all_india.data.at(-1))],
    ["pv-census", (b) => fmt.count(b["gender-t002"].series.all_india.data.at(-1))],
    ["prov-vintage", (b) => b["gender-t007"].meta.vintage],
    ["prov-vintage2", (b) => b["gender-t007"].meta.vintage],
  ]},
  { url: "/guides/mnre/", slug: null, checks: [
    ["n-total", (b) => fmt.gw1(b["mnre-sources"].series.grand_total.data.at(-1))],
    ["n-solar-share", (b) => fmt.pct0(b["mnre-sources"].series.solar.data.at(-1) / b["mnre-sources"].series.grand_total.data.at(-1) * 100)],
    ["cr-total", (b) => fmt.gw1(b["mnre-sources"].series.grand_total.data.at(-1))],
    ["pv-total", (b) => fmt.num1(b["mnre-sources"].series.grand_total.data[0] / 1000) + " → " + fmt.num1(b["mnre-sources"].series.grand_total.data.at(-1) / 1000)],
    ["pv-sources", (b) => fmt.x1(b["mnre-sources"].series.solar.data.at(-1) / b["mnre-sources"].series.wind.data.at(-1))],
    ["pv-solar", (b) => fmt.pct0(b["mnre-solar-categories"].series.rooftop.data.at(-1) / b["mnre-sources"].series.solar.data.at(-1) * 100)],
    // households wave 2: bio power by kind, rooftop by state
    ["pv-bio", (b) => fmt.pct0(b["mnre-bio-categories"].series.bagasse.data.at(-1) / b["mnre-bio-categories"].series.total.data.at(-1) * 100)],
    ["pv-rooftop", (b) => { const v = Object.entries(b["mnre-states-solar"].series).filter(([k]) => k.endsWith("__rooftop")).map(([, s]) => s.data.at(-1)).filter((x) => x > 0).sort((a, c) => c - a); return fmt.pct0((v[0] + v[1]) / v.reduce((a, x) => a + x, 0) * 100); }],
    ["prov-vintage", (b) => b["mnre-sources"].meta.vintage],
    ["prov-vintage2", (b) => b["mnre-sources"].meta.vintage],
  ]},
  // health-gender: NFHS-5 and NFHS-4 read from their own bundles (two rounds, two rulers)
  { url: "/guides/nfhs/", slug: null, minPlots: 18, checks: [
    ["n-anaemia", (b) => fmt.pct1(nfhsV(b, 5, "anaemia", /^Children age 6-59/))],
    ["rb-anaemia", (b) => fmt.pct1(nfhsV(b, 5, "anaemia", /^Children age 6-59/))],
    ["d-anaemia", (b) => fmt.pct1(nfhsV(b, 4, "anaemia", /^Children age 6-59/)) + " in NFHS-4"],
    ["n-stunting", (b) => fmt.pct1(nfhsV(b, 5, "child-nutrition", /are stunted/))],
    ["n-institutional", (b) => fmt.pct1(nfhsV(b, 5, "delivery", /^Institutional births \(in/))],
    ["n-bp", (b) => fmt.pct1(nfhsV(b, 5, "blood-pressure", /^Men .*Elevated blood pressure \(Systolic ≥140/))],
    ["pv-anaemia", (b) => fmt.pct1(nfhsV(b, 5, "anaemia", /^Children age 6-59/))],
    ["ex-an-rose", (b) => { const s5 = nfhsStates(b, 5, "anaemia", /^Children age 6-59/), s4 = new Map(nfhsStates(b, 4, "anaemia", /^Children age 6-59/).map((x) => [x.geo, x.v])); return fmt.count(s5.filter((x) => s4.has(x.geo) && x.v > s4.get(x.geo)).length); }],
    ["pv-cancer", (b) => fmt.pct1(nfhsV(b, 5, "cancer-screening", /cervical/))],
    ["pv-violence", (b) => fmt.pct1(nfhsV(b, 5, "violence", /spousal violence/))],
    ["pv-tfr", (b) => fmt.num2(nfhsV(b, 5, "marriage-fertility", /Total Fertility/))],
    ["ex-bi-oop", (b) => fmt.inr(nfhsV(b, 5, "maternity", /out-of-pocket/))],
    ["pv-household", (b) => fmt.pct1(nfhsV(b, 5, "household", /improved sanitation/))],
    ["prov-vintage", (b) => b["nfhs-5-anaemia"].meta.vintage],
    ["prov-vintage2", (b) => b["nfhs-5-anaemia"].meta.vintage],
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
    // households wave 2: owners, age, banks, original maturity, the quarterly return
    ["pv-sectors", (b) => fmt.pct1(100 * b["deposits-sectors"].series.s4__total.data.at(-1) / b["deposits-sectors"].series.total__total.data.at(-1))],
    ["pv-age", (b) => { const s = b["deposits-age"].series; const ks = Object.keys(s).filter((k) => k.startsWith("individuals__") && k.endsWith("__total")); const t = ks.reduce((a, k) => a + s[k].data.at(-1), 0); return fmt.pct1(100 * (s.individuals__a7_60_to_69__total.data.at(-1) + s.individuals__a8_70_and_above__total.data.at(-1)) / t); }],
    ["pv-banks", (b) => fmt.pct1(100 * b["deposits-bankgroups-sectors"].series.total__private.data.at(-1) / b["deposits-bankgroups-sectors"].series.total__all_banks.data.at(-1))],
    ["pv-origmat", (b) => fmt.pct1(100 * b["deposits-maturity-owners"].series.m4_1_to_3_years__total.data.at(-1) / b["deposits-maturity-owners"].series.all__total.data.at(-1))],
    ["ex-q-tot", (b) => fmt.lc1(b["deposits-q-sectors"].series.total__total.data.at(-1) / 1e5)],
    ["prov-vintage", (b) => b["deposits-owners"].meta.vintage],
  ]},
  // ---- bis family session: debt (BIS total credit) ----
  { url: "/guides/debt/", slug: null, checks: [
    ["n-total", (b) => fmt.pct1(b["bis-credit"].series.total.data.at(-1))],
    // households are quoted for the last MEASURED quarter: later quarters are BIS estimates (series.estimated)
    ["n-hh", (b) => { const B = b["bis-credit"], est = new Set(B.series.households.estimated ?? []); const i = B.dates.findLastIndex((d, j) => B.series.households.data[j] != null && !est.has(d)); return fmt.pct1(B.series.households.data[i]); }],
    ["ex-s-hhe", (b) => fmt.pct1(b["bis-credit"].series.households.data.at(-1))],
    ["n-dsr", (b) => fmt.pct1(b["bis-dsr"].series.private.data.at(-1))],
    ["ex-s-co", (b) => { const B = b["bis-credit"], est = new Set(B.series.companies.estimated ?? []); const i = B.dates.findLastIndex((d, j) => B.series.companies.data[j] != null && !est.has(d)); return fmt.pct1(B.series.companies.data[i]); }],
    ["ex-s-gov", (b) => fmt.pct1(b["bis-credit"].series.government.data.at(-1))],
    ["pv-long", (b) => fmt.pct1(b["bis-credit"].series.private.data.at(-1))],
    ["ex-l-banks", (b) => fmt.pct1(b["bis-credit"].series.private_banks.data.at(-1))],
    ["pv-inr", (b) => "₹" + Math.round(b["bis-credit-inr"].series.households.data.at(-1) / 1000) + " lakh crore"],
    ["pv-gap", (b) => { const g = b["bis-credit-gap"].series.gap.data.at(-1); return (g >= 0 ? "+" : "−") + Math.abs(g).toFixed(1) + " pt"; }],
    ["ex-d-cn", (b) => fmt.pct1(b["bis-peer-chn"].series.dsr.data.filter((v) => v != null).at(-1))],
    ["pv-gli", (b) => "$" + b["bis-gli"].series.usd.data.at(-1).toFixed(1) + " bn"],
    ["prov-vintage", (b) => b["bis-credit"].meta.vintage],
  ]},
  // house prices: BIS y/y as published; RBI city levels; RESIDEX prices per sq ft
  { url: "/guides/housing/", slug: null, checks: [
    ["n-nom", (b) => fmt.pct1(b["bis-property"].series.nominal_yoy.data.at(-1))],
    ["n-real", (b) => fmt.pct1(b["bis-property"].series.real_yoy.data.at(-1))],
    ["rb-real", (b) => fmt.pct2(b["bis-property"].series.real_yoy.data.at(-1))],
    ["pv-nr", (b) => b["bis-property"].series.real.data.at(-1).toFixed(1)],
    ["ex-nr-nom", (b) => b["bis-property"].series.nominal.data.at(-1).toFixed(1)],
    ["ex-c-top", (b) => b["housing-rbi-2022"].series.chennai.data.at(-1).toFixed(1)],
    ["ex-c-bot", (b) => b["housing-rbi-2022"].series.delhi.data.at(-1).toFixed(1)],
    ["pv-cities10", (b) => Math.max(...Object.values(b["housing-rbi-2010"].series).map((s) => s.data.at(-1))).toFixed(0)],
    ["pv-price", (b) => "₹" + Math.round(Math.max(...Object.entries(b["housing-residex-prices-2025"].series).filter(([k]) => /_hfc_price$/.test(k)).map(([, s]) => s.data.at(-1)))).toLocaleString("en-IN")],
    ["ex-x-india", (b) => { const s = b["housing-residex-2025"].series.india_hfc.data; const v = (s.at(-1) / s.at(-5) - 1) * 100; return (v < 0 ? "−" : "+") + Math.abs(v).toFixed(1) + "%"; }],
    ["prov-vintage", (b) => b["bis-property"].meta.vintage],
  ]},
  // ---- end bis family ----
  // ---- services ----
  { url: "/guides/services/", slug: null, checks: [
    // title block: share of GVA (2022-23 base), annual services exports (RBI 807), service jobs (PLFS CY)
    ["n-share", (b) => fmt.pct1(b["services-gva-2022-share"].series.services.data.at(-1))],
    ["rb-share", (b) => fmt.pct1(b["services-gva-2022-share"].series.services.data.at(-1))],
    ["n-exp", (b) => "$" + Math.round(b["services-bop-annual"].series.s1_2_1_credit.data.at(-1) / 1000) + " bn"],
    ["n-jobs", (b) => fmt.pct1(b["services-jobs-cy25"].series.tertiary__person_all_cws.data.at(-1))],
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
  // --- states (state economies): title block from the fixed panel; plate values recomputed
  // here from the bundles, independently of the page's code
  { url: "/guides/states/", slug: null, checks: [
    ["n-gap", (b) => fmt.x1(b["states-spread"].series.gap_current.data.at(-1))],
    ["n-rich", (b) => fmt.inrR(b["states-spread"].series.richest_current.data.at(-1))],
    ["n-poor", (b) => fmt.inrR(b["states-spread"].series.poorest_current.data.at(-1))],
    ["n-grow", (b) => fmt.pct1(b["states-spread"].series.median_real_growth.data.at(-1))],
    ["ex-gap-0", (b) => fmt.x1(b["states-spread"].series.gap_current.data[0])],
    ["ex-cv-l", (b) => fmt.pct1(b["states-spread"].series.cv_constant.data.at(-1))],
    ["pv-pc", (b) => { const B = b["states-pcnsdp-current"], i = B.dates.indexOf(b["states-spread"].dates.at(-1)); return fmt.inrR(Math.max(...Object.entries(B.series).filter(([k]) => k !== "jammu_and_kashmir_state").map(([, s]) => s.data[i]).filter((v) => v != null))); }],
    ["pv-size", (b) => { const B = b["states-gsdp-current"], i = B.dates.indexOf(b["states-spread"].dates.at(-1)); return "₹" + (Math.max(...Object.values(B.series).map((s) => s.data[i]).filter((v) => v != null)) / 1e5).toFixed(2) + " lakh cr"; }],
    ["pv-growth", (b) => {
      const B = b["states-gsdp-constant"], D = b["states-spread"].dates, i0 = B.dates.indexOf(D[0]), i1 = B.dates.indexOf(D.at(-1)), n = +D.at(-1).slice(0, 4) - +D[0].slice(0, 4);
      return fmt.pct1(Math.max(...Object.entries(B.series).filter(([k]) => !k.startsWith("jammu_and_kashmir")).map(([, s]) => s.data[i0] > 0 && s.data[i1] != null ? (Math.pow(s.data[i1] / s.data[i0], 1 / n) - 1) * 100 : -Infinity)));
    }],
    ["prov-vintage", (b) => b["states-pcnsdp-current"].meta.vintage],
  ]},
  // worldbank family (2026-10-09): every check renders through fmt from the bundles
  { url: "/guides/poverty/", slug: null, minPlots: 7, checks: [
    ["rb-h3", (b) => fmt.pct2(b["poverty-pip-2022"].series.headcount_3_00.data.at(-1))],
    ["rb-h42", (b) => fmt.pct2(b["poverty-pip-2022"].series.headcount_4_20.data.at(-1))],
    ["ex-la-3", (b) => fmt.pct1(b["poverty-pip-2022"].series.headcount_3_00.data.at(-1))],
    ["ex-la-83", (b) => fmt.pct1(b["poverty-pip-2022"].series.headcount_8_30.data.at(-1))],
    // the rupee value of $3.00 a day: line x PIP's PPP factor x CPI ratio, at the latest survey
    ["ex-la-r3", (b) => { const s = b["poverty-pip-2022"].series; return fmt.inrR(3 * s.ppp.data.at(-1) * s.cpi.data.at(-1)); }],
    ["ex-po-n", (b) => fmt.num1(b["poverty-pip-2022"].series.poor_3_00.data.at(-1)) + " million"],
    ["pv-gini", (b) => fmt.num1(b["poverty-pip-2022"].series.gini.data.at(-1))],
    ["ex-dc-top", (b) => fmt.pct1(b["poverty-pip-2022"].series.decile10.data.at(-1))],
    ["ex-re-11", (b) => fmt.pct1(b["poverty-pip-2011"].series.headcount_3_00.data[0])],
    ["ex-qu-nat", (b) => fmt.pct1(b["poverty-wdi"].series.si_pov_nahc.data.filter((v) => v != null).at(-1))],
    ["prov-vintage", (b) => b["poverty-pip-2022"].meta.vintage],
  ]},
  { url: "/guides/population/", slug: null, minPlots: 11, checks: [
    ["rb-pop", (b) => (b["population-wpp"].series.tpopulation1july.data.at(-1) / 1e6).toFixed(3) + " billion"],
    ["n-tfr", (b) => fmt.num2(b["population-wpp"].series.tfr.data.at(-1))],
    ["n-age", (b) => fmt.num1(b["population-wpp"].series.medianagepop.data.at(-1)) + " years"],
    ["ex-wi-now", (b) => fmt.pct1(b["population-wpp-age"].series.share_15_64.data.at(-1))],
    ["ex-li-now", (b) => fmt.num1(b["population-wpp"].series.lex.data.at(-1))],
    ["ex-cu-2100", (b) => (b["population-wpp-projection"].series.tpopulation1july.data.at(-1) / 1e6).toFixed(2) + " billion"],
    ["ex-bi-deaths", (b) => fmt.num1(b["population-wpp"].series.deaths.data.at(-1) / 1e3) + " million"],
    ["ex-ur-last", (b) => fmt.pct1(b["population-wdi-urban"].series.sp_urb_totl_in_zs.data.at(-1))],
    ["prov-vintage", (b) => b["population-wpp"].meta.vintage],
  ]},
  // climate (lb/climate): figures recomputed here from the bundles, independently of
  // src/dossiers/climate.data.js, through the shared formatters
  ...(() => {
    const yr = (d) => +d.slice(0, 4), mean = (a) => a.reduce((s, v) => s + v, 0) / a.length;
    const wm = (b, k, y0, y1) => mean(b.dates.map((d, i) => (yr(d) >= y0 && yr(d) <= y1 ? b.series[k].data[i] : null)).filter((v) => v != null));
    const sd = (v, f) => (v < 0 ? "−" : "+") + f(Math.abs(v)) + "°C";
    const dys = (v) => fmt.count(v) + (Math.round(v) === 1 ? " day" : " days");
    const an = (b) => b["climate-temp-monthly"].series.temperature_anomaly.data;
    const lastYr = (b, s, k) => { const i = b[s].dates.indexOf(b[s].dates.filter((d, j) => b[s].series[k].data[j] != null).at(-1)); return b[s].series[k].data[i]; };
    return [{ url: "/guides/climate/", slug: null, minPlots: 18, checks: [
      ["n-anom", (b) => sd(an(b).at(-1), fmt.num2)],
      ["rb-anom", (b) => sd(an(b).at(-1), fmt.num2)],
      ["rb-12", (b) => sd(mean(an(b).slice(-12)), fmt.num2)],
      ["n-rank", (b) => { const d = b["climate-temp-monthly"].dates, m = d.at(-1).slice(5, 7); const vals = d.map((x, i) => [x, an(b)[i]]).filter(([x, v]) => x.slice(5, 7) === m && v != null).sort((p, q) => q[1] - p[1]); const r = vals.findIndex(([x]) => x === d.at(-1)) + 1; return ["first", "second", "third", "fourth", "fifth", "sixth", "seventh", "eighth", "ninth", "tenth"][r - 1] ?? r + (r % 100 >= 11 && r % 100 <= 13 ? "th" : ["th", "st", "nd", "rd"][r % 10] ?? "th"); }],
      ["n-century", (b) => sd(wm(b["climate-cru"], "tas", 2016, 2025) - wm(b["climate-cru"], "tas", 1901, 1930), fmt.num1)],
      ["n-nights", (b) => dys(wm(b["climate-era5-hotdays"], "tr26", 1996, 2025))],
      ["d-nights", (b) => dys(wm(b["climate-era5-hotdays"], "tr26", 1951, 1980))],
      ["lr-wbt1", (b) => dys(wm(b["climate-era5-heatstress"], "wbt27", 1996, 2025))],
      ["lr-hd0", (b) => dys(wm(b["climate-era5-hotdays"], "hd40", 1951, 1980))],
      ["ex-h-tr", (b) => dys(lastYr(b, "climate-era5-hotdays", "tr26"))],
      ["n-pc", (b) => fmt.num1(b["climate-co2"].series.co2_per_capita.data.at(-1)) + " t"],
      ["d-pc", (b) => fmt.num1(b["climate-co2-world"].series.co2_per_capita.data.at(-1)) + " t"],
      ["pv-co2", (b) => fmt.inr(b["climate-co2"].series.co2.data.at(-1)) + " Mt"],
      ["ex-e-share", (b) => fmt.num1(b["climate-co2"].series.share_global_co2.data.at(-1)) + "%"],
      ["ex-s-cum", (b) => fmt.num1(b["climate-co2"].series.share_global_cumulative_co2.data.at(-1)) + "%"],
      ["pv-stock", (b) => fmt.num1(b["climate-co2"].series.share_of_temperature_change_from_ghg.data.at(-1)) + "%"],
      ["ex-r-base", (b) => fmt.inr(wm(b["climate-cru"], "pr", 1951, 1980)) + " mm"],
      ["ex-c-r1976", (b) => { const c = b["climate-cru"]; const p = c.dates.map((d, i) => [yr(d), c.series.tas.data[i]]).filter(([y, v]) => y >= 1976 && v != null); const mx = mean(p.map((x) => x[0])), my = mean(p.map((x) => x[1])); return fmt.num2(10 * p.reduce((s, [x, y]) => s + (x - mx) * (y - my), 0) / p.reduce((s, [x]) => s + (x - mx) ** 2, 0)) + "°C"; }],
      ["ex-en-coal", (b) => { const e = b["climate-energy"]; return fmt.num1(lastYr(b, "climate-energy", "coal_share_energy")) + "%"; }],
      ["ex-p-245-40", (b) => { const w = b["climate-cmip6-windows-temp"]; return sd(w.series.tas__change__ssp245__median.data[w.dates.indexOf("2040-01-01")], fmt.num1); }],
      ["ex-p-585-80", (b) => { const w = b["climate-cmip6-windows-temp"]; return sd(w.series.tas__change__ssp585__median.data[w.dates.indexOf("2080-01-01")], fmt.num1); }],
      ["ex-s-delhi", (b) => sd(wm(b["climate-cru-states"], "tas__delhi", 1996, 2025) - wm(b["climate-cru-states"], "tas__delhi", 1951, 1980), fmt.num1)],
      ["prov-vintage", (b) => b["climate-temp-monthly"].meta.vintage],
    ]}];
  })(),
  // ilo: titleblock and plate values straight from the ILO bundles
  { url: "/guides/ilo/", slug: null, checks: [
    ["n-emp", (b) => fmt.num1(b["ilo-est-emp-2emp"].series.emp_2emp_sex_age_nb__sex_t__age_ythadult_yge15.data.filter((v) => v != null).at(-1) / 1000) + " million"],
    ["n-lfpr", (b) => fmt.pct1(b["ilo-est-eap-2wap"].series.eap_2wap_sex_age_rt__sex_t__age_ythadult_yge15.data.at(-1))],
    ["n-women", (b) => fmt.pct1(b["ilo-est-eap-2wap"].series.eap_2wap_sex_age_rt__sex_f__age_ythadult_yge15.data.at(-1))],
    ["n-neet", (b) => fmt.pct1(b["ilo-est-eip-2eet"].series.eip_2eet_sex_rt__sex_f.data.at(-1))],
    ["pv-unemp", (b) => fmt.pct1(b["ilo-est-une-2eap"].series.une_2eap_sex_age_rt__sex_t__age_ythadult_yge15.data.at(-1))],
    ["ex-r-psss", (b) => fmt.pct1(b["plfs-annual"].series.lfpr_psss.data.at(-1))],
    ["ex-i-tot", (b) => fmt.pct1(b["ilo-plfs-sdg"].series.sdg_0831_sex_eco_rt__sex_t__eco_sector_total.data.at(-1))],
    ["prov-vintage", (b) => b["ilo-est-eap-2wap"].meta.vintage],
  ]},
  // --- rates (atlas-rates): the title block, the plates' lead values, provenance
  { url: "/guides/rates/", slug: null, checks: [
    ["n-repo", (b) => fmt.pct2(b["rates-monthly"].series.repo.data.at(-1))],
    ["pv-long", (b) => fmt.pct2(b["rates-policy"].series.repo.data.at(-1))],
    ["ex-long-bank", (b) => fmt.pct2(b["rates-policy"].series.bank_rate.data.at(-1))],
    ["n-walr", (b) => fmt.pct2(b["rates-lending"].series.walr_fresh_all.data.at(-1))],
    ["ex-pass-do", (b) => fmt.pct2(b["rates-lending"].series.wadtdr_outstanding_all.data.at(-1))],
    ["n-fd", (b) => fmt.pct2(b["rates-lending"].series.wadtdr_fresh_all.data.at(-1))],
    ["ex-mpc-n", (b) => fmt.count(b["rates-mpc"].dates.length)],
    ["pv-votes", (b) => fmt.count(b["rates-mpc-votes"].series.votes_against.data.reduce((a, c) => a + c, 0))],
    ["pv-bench", (b) => fmt.pct2(b["rates-benchmarks"].series.all_eblr.data.at(-1))],
    ["pv-loans", (b) => fmt.pct2(b["rates-walr-sectors"].series.fresh_housing.data.at(-1))],
    ["pv-cards", (b) => fmt.pct2(b["rates-walr-occupation"].series.personal_credit_cards.data.at(-1))],
    ["pv-mclr", (b) => fmt.pct2(b["rates-mclr"].series.all_median.data.at(-1))],
    ["ex-real-cpi", (b) => fmt.pct2(b["rates-real"].series.cpi.data.at(-1))],
    ["ex-curve-10", (b) => fmt.pct2(b["rates-gsec-curve"].series.y10.data.at(-1))],
    ["ex-call-avg", (b) => fmt.pct2(b["rates-call-monthly"].series.average.data.at(-1))],
    ["ex-bor-c", (b) => fmt.lc1(b["rates-borrowing"].series.centre_gross.data.at(-1) / 1e5)],
    ["prov-vintage", (b) => b["rates-monthly"].meta.vintage],
  ]},
  // credit (lb/credit): title block, the headline plate and a value from each part of the guide
  { url: "/guides/credit/", slug: null, minPlots: 18, checks: [
    ["n-growth", (b) => b["credit-growth"].series.headline.data.at(-1).toFixed(1) + "%"],
    ["rb-growth", (b) => b["credit-growth"].series.headline.data.at(-1).toFixed(1) + "%"],
    ["pv-growth", (b) => fmt.pct1(b["credit-scb-ratios"].series.credit_growth.data.at(-1))],
    ["ex-cd-now", (b) => fmt.pct1(b["credit-scb-ratios"].series.credit_deposit_ratio.data.at(-1))],
    ["ex-w-house", (b) => { const S = b["credit-sectors"].series, i = b["credit-sectors"].dates.length - 1; return fmt.pct1((100 * S.housing.data[i]) / ["agriculture", "industry", "services", "personal_loans"].reduce((a, k) => a + S[k].data[i], 0)); }],
    ["ex-p-gold", (b) => fmt.pct1(b["credit-growth"].series.gold_loans.data.at(-1))],
    ["pv-m3", (b) => fmt.pct1(b["credit-money-growth"].series.m3_incl_merger.data.at(-1))],
    ["pv-states", (b) => fmt.pct1(b["credit-states-cd-annual"].series.all_india.data.at(-1))],
    ["pv-women", (b) => fmt.pct1(b["credit-women"].series.all_india_women_share.data.at(-1))],
    ["pv-npa", (b) => fmt.pct1(b["credit-npa"].series.all_gnpa_ratio.data.at(-1))],
    ["ex-nf-close", (b) => fmt.lc1(b["credit-npa-movement"].series.all_gross_closing.data.at(-1))],
    ["prov-vintage", (b) => b["credit-growth"].meta.vintage],
  ]},
  // --- trade (lb/trade): figures in US$ million in the bundles, shown as US$ billion ---
  { url: "/guides/trade/", slug: null, minPlots: 12, checks: [
    ["n-exp", (b) => fmt.bnFixed1(b["trade-total"].series.exports.data.at(-1) / 1000)],
    ["n-imp", (b) => fmt.bnFixed1(b["trade-total"].series.imports.data.at(-1) / 1000)],
    ["n-bal", (b) => fmt.bnFixed1(b["trade-total"].series.balance.data.at(-1) / 1000)],
    ["rb-big", (b) => fmt.bnFixed1(b["trade-total"].series.balance.data.at(-1) / 1000)],
    ["n-ytd", (b) => fmt.bnFixed1(b["trade-hs2-exports-ytd"].series.total.data.at(-1) / 1000)],
    ["pv-month", (b) => fmt.bnFixed1(b["trade-total"].series.balance.data.at(-1) / 1000)],
    ["ex-l-exp", (b) => fmt.bnFixed1(b["trade-dbie-annual"].series.exports.data.at(-1) / 1000)],
    ["pv-oilm", (b) => fmt.bnFixed1(b["trade-dbie-monthly"].series.balance_oil.data.at(-1) / 1000)],
    ["pv-oilgold", (b) => { const X = b["trade-principal-exports-fy"].series, M = b["trade-principal-imports-fy"].series, at = (s) => s.data.at(-1);
      return fmt.pct1(100 * ((at(X.g20) - at(M.g20)) + (at(X.ig6) - at(M.ig6))) / (at(X.total) - at(M.total))); }],
    ["pv-partners", (b) => fmt.bnFixed1(b["trade-partners-balance-fy"].series.china.data.at(-1) / 1000)],
    ["pv-crude", (b) => { const s = b["trade-dbie-oil-volumes"].series, i = s.crude_imports.data.at(-1), p = s.crude_production.data.at(-1); return fmt.pct1(100 * i / (i + p)); }],
    ["prov-vintage", (b) => b["trade-total"].meta.vintage],
  ]},
  // --- end trade ---
  // --- payments (lb/payments): every rendered figure through src/dossiers/payments.fmt.js, the client's own formatters ---
  { url: "/guides/payments/", slug: null, minPlots: 30, checks: [
    ["n-upi", (b) => PF.crore(b["payments-monthly"].series.upi_volume.data.at(-1))],
    ["rb-upi", (b) => PF.crore(b["payments-monthly"].series.upi_volume.data.at(-1))],
    ["n-upiv", (b) => PF.lakhCrore(b["payments-monthly"].series.upi_value.data.at(-1))],
    ["rb-share", (b) => { const s = b["payments-monthly"].series; return PF.share(s.upi_volume.data.at(-1), s.retail_total_volume.data.at(-1)); }],
    ["n-avg", (b) => PF.rupees(b["payments-ticket"].series.upi.data.at(-1))],
    ["n-atm", (b) => PF.crore(b["payments-monthly"].series.atm_cash_volume.data.at(-1))],
    ["pv-ticket", (b) => PF.rupees(b["payments-ticket"].series.upi.data.at(-1))],
    ["ex-tk-dc", (b) => PF.rupees(b["payments-ticket"].series.debit_cards.data.at(-1))],
    ["pv-upi", (b) => PF.crore(b["payments-monthly"].series.upi_volume.data.at(-1))],
    ["ex-upi-n0", (b) => PF.crore(b["payments-monthly"].series.upi_volume.data[0])],
    ["pv-share", (b) => { const s = b["payments-monthly"].series; return PF.share(s.rtgs_value.data.at(-1), s.total_value.data.at(-1)); }],
    ["pv-value", (b) => PF.lakhCrore(b["payments-monthly"].series.rtgs_value.data.at(-1))],
    ["pv-cards", (b) => PF.crore(b["payments-monthly"].series.credit_cards_volume.data.at(-1))],
    ["ex-cd-ndc", (b) => PF.crore(b["payments-infra"].series.debit_cards.data.at(-1))],
    ["ex-cs-n", (b) => PF.crore(b["payments-monthly"].series.atm_cash_volume.data.at(-1))],
    ["pv-cash", (b) => "₹" + b["credit-money"].series.currency_with_public.data.at(-1).toFixed(2) + " lakh crore"],
    ["pv-machines", (b) => PF.count(b["payments-infra"].series.upi_qr.data.at(-1))],
    ["ex-mc-atm", (b) => PF.count(b["payments-infra"].series.atms.data.at(-1))],
    ["pv-systems", (b) => PF.count(b["payments-monthly"].series.nach_dr_volume.data.at(-1))],
    ["pv-channels", (b) => PF.lakhCrore(b["payments-monthly"].series.mobile_value.data.at(-1))],
    ["pv-annual", (b) => PF.crore(b["payments-annual"].series.upi_volume.data.at(-1))],
    ["ex-an-tot", (b) => PF.crore(b["payments-annual"].series.total_volume.data.at(-1))],
    ["pv-long", (b) => PF.crore(b["payments-monthly"].series.neft_volume.data.at(-1))],
    ["ex-lg-neft0", (b) => PF.count(b["payments-monthly-2004"].series.neft_volume.data[0])],
    ["pv-cheques", (b) => PF.crore(b["payments-annual"].series.paper_volume.data.at(-1))],
    ["ex-cq-0", (b) => PF.crore(b["payments-cheques-1970"].series.all_india_number.data[0])],
    ["pv-clearing", (b) => b["payments-clearing-houses"].series.total.data.at(-1).toLocaleString("en-IN")],
    ["ex-cl-n0", (b) => b["payments-clearing-houses"].series.total.data[0].toLocaleString("en-IN")],
    ["ex-cl-grid", (b) => PF.crore(b["payments-cheques-centres"].series.national_grid_number.data.at(-1))],
    ["pv-erupee", (b) => PF.rsCrore(b["payments-erupee"].series.total.data.at(-1))],
    ["ex-er-prev", (b) => PF.rsCrore(b["payments-erupee"].series.total.data.at(-2))],
    ["prov-vintage", (b) => b["payments-monthly"].meta.vintage],
  ]},
  // --- end payments ---
  // --- public-finance (lb/public-finance): the title block, each plate's lead value, provenance ---
  { url: "/guides/public-finance/", slug: null, minPlots: 18, checks: (() => {
    const P = (b, k) => b["public-finance-" + k];
    const first = (b, k) => b.series[k].data.find((v) => v != null);
    const last = (b, k) => b.series[k].data.filter((v) => v != null).at(-1);
    const fyAt = (b, k, fy) => b.series[k].data[b.dates.indexOf(fy.slice(0, 4) + "-04-01")];
    const lakh2 = (v) => "₹" + fmt.lakhN(v) + " lakh crore", lakh1 = (v) => "₹" + fmt.num1(v / 1e5) + " lakh crore";
    return [
      ["n-ytd", (b) => fmt.pct1(last(P(b, "centre-monthly"), "fiscal_deficit_pct_be"))],
      ["rb-ytd", (b) => fmt.pct1(last(P(b, "centre-monthly"), "fiscal_deficit_pct_be"))],
      ["rb-ytd-inr", (b) => lakh2(last(P(b, "centre-monthly"), "fiscal_deficit"))],
      ["n-gfd", (b) => fmt.pct2(first(P(b, "centre-gdp-b2011"), "gross_fiscal_deficit__be")) + " of GDP"],
      ["n-int", (b) => "₹" + fmt.num1(100 * first(P(b, "centre-expenditure"), "interest_payments__be") / first(P(b, "centre-receipts"), "revenue_receipts__be"))],
      ["n-debt", (b) => fmt.pct1(first(P(b, "combined-debt-gdp-b2011"), "combined_total_liabilities_of_centre_and_states__be"))],
      ["pv-deficit", (b) => fmt.pct2(first(P(b, "centre-gdp-b2011"), "gross_fiscal_deficit__be"))],
      ["ex-def-acc", (b) => { const g = P(b, "centre-gdp-b2011"); return fmt.pct2(fyAt(g, "gross_fiscal_deficit", P(b, "centre-deficits").meta.stages.accountsTo)); }],
      ["pv-ytd", (b) => fmt.pct1(last(P(b, "centre-monthly"), "fiscal_deficit_pct_be"))],
      ["ex-ytd-inr", (b) => lakh2(last(P(b, "centre-monthly"), "fiscal_deficit"))],
      ["pv-financing", (b) => { const f = P(b, "centre-financing"); return fmt.pct0(100 * first(f, "market_borrowings__be") / first(f, "gross_fiscal_deficit__be")); }],
      ["pv-spend", (b) => "₹" + fmt.num1(100 * first(P(b, "centre-expenditure"), "interest_payments__be") / first(P(b, "centre-expenditure"), "total_expenditure__be"))],
      ["pv-interest", (b) => "₹" + fmt.num1(100 * first(P(b, "centre-expenditure"), "interest_payments__be") / first(P(b, "centre-receipts"), "revenue_receipts__be"))],
      ["pv-capex", (b) => fmt.pct2(first(P(b, "centre-gdp-b2011"), "capital_expenditure__be"))],
      ["pv-debt", (b) => fmt.pct1(first(P(b, "combined-debt-gdp-b2011"), "combined_total_liabilities_of_centre_and_states__be"))],
      ["pv-holders", (b) => lakh1(last(P(b, "ownership-gsec"), "total"))],
      ["pv-tbills", (b) => { const t = P(b, "tbills").series, at = (k) => t[k].data.at(-1) ?? 0; return lakh2(at("t91__total") + at("t182__total") + at("t364__total") + at("cmb__total")); }],
      ["pv-maturity", (b) => lakh1(last(P(b, "maturity"), "total_amount"))],
      ["pv-savings", (b) => lakh1(last(P(b, "small-savings"), "total__outstanding"))],
      ["pv-wma", (b) => fmt.count(P(b, "states-wma").series.states_using_od.data.at(-1))],
      ["pv-gdpbase", (b) => { const r = P(b, "ratios-2022"), acc = P(b, "centre-deficits").meta.stages.accountsTo; return fmt.pct2(fyAt(r, "centre_gross_fiscal_deficit", acc)); }],
      ["prov-vintage", (b) => P(b, "centre-monthly").meta.vintage],
    ];
  })() },
  // --- end public-finance ---
  { url: "/", slug: null, minPlots: 1, checks: [
    // the CPI print is the 2024-base series; core stays on the 2012 base
    // (no weights served for the new base), labelled "to Dec 2025"
    ["v-cpi", (b) => fmt.pct2(b["cpi-2024"].series.headline.data.at(-1)), "cpi-2024"],
    // the GDP print is the 2022-23-base series (old base ends Q2 FY26)
    ["v-gdp", (b) => fmt.pct2(b["gdp-2022"].series.gdp.data.at(-1)), "gdp-2022"],
  ]},
  // the guides index: one small chart per guide
  // ---- farms (lb/farms): title block and plate values recomputed from the bundles ----
  { url: "/guides/farms/", slug: null, minPlots: 18, checks: [
    ["n-fg", (b) => fmt.num1(b["farms-production"].series.foodgrains.data.at(-1) / 1000) + " mt"],
    ["rb-fg", (b) => fmt.num1(b["farms-production"].series.foodgrains.data.at(-1) / 1000) + " mt"],
    ["rb-side", (b) => fmt.num1(b["farms-advance"].series.production_foodgrains.data[0] / 1000) + " mt"],
    ["n-yield", (b) => fmt.inr(b["farms-yield"].series.wheat.data.at(-1)) + " kg"],
    ["n-msp", (b) => { const d = b["farms-msp"].series.paddy_common.data; return fmt.inrR(d.filter((v) => v != null).at(-1)); }],
    ["n-stock", (b) => fmt.num1(b["farms-pds"].series.stocks_total.data.at(-1) / 10) + " mt"],
    ["pv-harvest", (b) => fmt.num1(b["farms-production"].series.foodgrains.data.at(-1) / 1000) + " mt"],
    ["pv-grains", (b) => fmt.num1(b["farms-production"].series.rice.data.at(-1) / 1000) + " mt"],
    ["pv-crops", (b) => fmt.num1(b["farms-production"].series.sugarcane.data.at(-1) / 1000)],
    ["pv-area", (b) => fmt.num1(b["farms-area"].series.foodgrains.data.at(-1) / 1000)],
    ["pv-index", (b) => fmt.num1(b["farms-index-2008"].series.production_all_crops.data.at(-1))],
    ["pv-land", (b) => fmt.pct1(b["farms-landuse"].series.irrigated_share.data.at(-1))],
    ["pv-fert", (b) => fmt.num1(b["farms-landuse"].series.fertiliser_per_ha.data.at(-1))],
    ["pv-stocks", (b) => fmt.num1(b["farms-pds"].series.stocks_total.data.at(-1) / 10) + " mt"],
    ["ex-st-lv", (b) => fmt.num1(b["farms-pds-latest"].series.stocks_total.data[0] / 10) + " million tonnes"],
    ["ex-ha-gross", (b) => { const Y = b["farms-yield"], M = b["farms-msp"]; const d = Y.dates.filter((x, i) => Y.series.wheat.data[i] != null && M.series.wheat.data[M.dates.indexOf(x)] != null).at(-1); return fmt.inrR(Math.round(Y.series.wheat.data[Y.dates.indexOf(d)] * M.series.wheat.data[M.dates.indexOf(d)] / 100)); }],
    ["prov-vintage", (b) => b["farms-production"].meta.vintage],
  ]},
  // ---- end farms ----
  { url: "/guides/", slug: null, minPlots: 13, checks: [] },
  // markets (lb/markets): the title block, the headline plate and a value from every part of the guide
  { url: "/guides/markets/", slug: null, minPlots: 19, checks: [
    ["n-net", (b) => b["markets-hh-flows"].series.per_cent_of_gdp_as_per_cent_to_gdp.data.at(-1).toFixed(1) + "%"],
    ["pv-net", (b) => fmt.pct1(b["markets-hh-flows"].series.per_cent_of_gdp_as_per_cent_to_gdp.data.at(-1))],
    ["ex-net-g", (b) => fmt.pct1(b["markets-hh-flows"].series.gross_financial_assets_per_cent_of_gdp_as_per_cent_to_gdp.data.at(-1))],
    ["pv-flows", (b) => "₹" + (b["markets-hh-flows-annual"].series.gross_financial_assets_i_financial_assets.data.at(-1) / 1e5).toFixed(1) + " lakh crore"],
    ["pv-aum", (b) => "₹" + (b["markets-mf-aum"].series.aum.data.at(-1) / 1e5).toFixed(1) + " lakh crore"],
    ["pv-gold", (b) => fmt.inrR(b["markets-gold"].series.gold_mumbai.data.at(-1))],
    ["pv-issues", (b) => "₹" + (b["markets-issues-annual"].series.equity.data.at(-1) / 1e5).toFixed(2) + " lakh crore"],
    ["pv-cp", (b) => "₹" + (b["rates-cp"].series.outstanding.data.at(-1) / 1e5).toFixed(2) + " lakh crore"],
    ["pv-mcap", (b) => "₹" + (b["markets-mcap"].series.nse.data.at(-1) / 1e5).toFixed(1) + " lakh crore"],
    ["pv-listed", (b) => fmt.pct1Minus(b["markets-listed-q"].series.sales.data.at(-1))],
    ["ex-ls-n", (b) => b["markets-listed-q"].series.companies.data.at(-1).toLocaleString("en-IN")],
    ["pv-sectors", (b) => fmt.pct1Minus(b["markets-listed-q-sector"].series.icc_manf__sales.data.at(-1))],
    ["pv-coverage", (b) => fmt.x1(b["markets-listed-q-ratios"].series.int_cvg.data.at(-1))],
    ["pv-studies", (b) => fmt.pct1Minus(b["markets-co-public-growth"].series.net_sales.data.at(-1))],
    ["pv-debt", (b) => fmt.pct1(b["markets-co-public-ratios"].series.debt_to_equity.data.at(-1))],
    ["prov-vintage", (b) => b["markets-hh-flows"].meta.vintage],
  ]},
  { url: "/register/", slug: null, minPlots: 8, checks: [] },
  // profiles (lb/profiles): five profiles of different shapes run their charts here and in lint-charts
  ...["bihar", "kerala", "goa", "ladakh", "telangana"].map((s) => ({ url: `/states/${s}/`, slug: null, minPlots: 4, checks: [] })),
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
  // --- banks (lb/banks): every number recomputed from the bundles ---
  { url: "/guides/banks/", slug: null, minPlots: 20, checks: [
    ["n-npa", (b) => fmt.pct2(b["banks-health"].series.all_gnpa.data.at(-1))],
    ["pv-npa", (b) => fmt.pct2(b["banks-health"].series.all_gnpa.data.at(-1))],
    ["ex-n-psb", (b) => fmt.pct2(b["banks-health"].series.psb_gnpa.data.at(-1))],
    ["n-psb", (b) => fmt.pct1(b["banks-ratios"].series.psb_deposit_share.data.at(-1))],
    ["ex-s-pvt", (b) => fmt.pct1(b["banks-shares"].series.private__deposits.data.at(-1))],
    ["n-crar", (b) => fmt.pct2(b["banks-ratios"].series.all_crar.data.at(-1))],
    ["ex-c-all", (b) => fmt.pct2(b["banks-ratios"].series.all_crar.data.at(-1))],
    ["n-roa", (b) => fmt.pct2(b["banks-ratios"].series.all_roa.data.at(-1))],
    ["pv-profit", (b) => { const p = b["banks-groups-profitability"]; const i = p.dates.findLastIndex((d) => d.endsWith("-03-01")); return fmt.lc1(p.series.all__net_profit_loss_pat__global.data[i] / 1e5); }],
    ["pv-margins", (b) => fmt.pct2(b["banks-groups-performance"].series.all__net_interest_margin_nim_annualized__domestic.data.at(-1))],
    ["ex-mg-sbi", (b) => fmt.lc1(Math.round(b["banks-balance-sheet"].series.state_bank_of_india__total_deposits__domestic.data.at(-1) / 1e3) / 100)],
    ["pv-sector-npa", (b) => fmt.pct2(b["banks-groups-sectoral"].series.all__industry_gnpa_ratio__domestic.data.at(-1))],
    ["pv-ucb", (b) => fmt.inr(b["banks-ucb-structure"].series.all__ucbs.data.at(-1))],
    ["ex-u-npa", (b) => fmt.pct2(b["banks-ucb-npa-dbie"].series.all__gross_npa_ratio.data.at(-1))],
    ["pv-insured", (b) => { const s = b["banks-fi-insured-deposits"].series; return fmt.pct1((100 * s.total_amount_of_insured_deposits.data.at(-1)) / s.total_amount_of_assessable_deposits.data.at(-1)); }],
    ["pv-fi", (b) => fmt.lc1(Math.round(b["banks-fi-nabard"].series.liabilities_total_liabilities.data.at(-1) / 1e3) / 100)],
    ["prov-vintage", (b) => b["banks-health"].meta.vintage],
  ]},
  // --- end banks ---
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
      // a per-page query, so an entry module several pages share (the 36 state profiles)
      // executes once per page instead of once per process (lb/profiles)
      await import(pathToFileURL(p).href + "?page=" + encodeURIComponent(page.url));
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
    const lv = (await import(pathToFileURL(path.join(ROOT, "scripts/lib/util.mjs")).href)).readRaw(ROOT, "data/raw/cpi-indices.json").levels;
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

// every-cut (F6, framework): each guide lists every series of every bundle it uses EXACTLY
// ONCE, inline or in one long-tail view (src/dossiers/everycut.js everyCutPlan). Rows are
// counted per file across the guide page and every long-tail page, and each file's count must
// equal its bundle's series count: a missing, doubled or misplaced bundle fails here. The guide
// page and each long-tail page also stay inside their HTML budgets (docs/CONTRACT-render.md).
{
  const EC = await import(pathToFileURL(path.join(ROOT, "src/dossiers/everycut.js")).href);
  const rowsPerFile = (h, into) => { for (const m of h.matchAll(/<tr (?:id="s[0-9a-z]{7}" )?data-o="\d+" data-file="([^"]+)"/g)) into.set(m[1], (into.get(m[1]) ?? 0) + 1); };
  for (const d of DOSSIERS) {
    const file = path.join(DIST, "guides", d.slug, "index.html");
    if (!fs.existsSync(file)) continue;   // "not built" is already reported above
    const html = fs.readFileSync(file, "utf8");
    if (!html.includes('id="every-cut"')) { fail(`/guides/${d.slug}/: no every-cut table (src/components/EveryCut.astro)`); continue; }
    if (html.length > 1.2e6) fail(`/guides/${d.slug}/: ${(html.length / 1e6).toFixed(2)} MB of HTML (budget 1.2 MB; lower everyCutInline)`);
    const seen = new Map();
    rowsPerFile(html, seen);
    const plan = EC.everyCutPlan(d);
    for (const t of plan.tails) {
      t.pages.forEach((_, i) => {
        const pf = path.join(DIST, "guides", d.slug, "every-cut", t.id, i ? String(i + 1) : "", "index.html");
        if (!fs.existsSync(pf)) { fail(`every-cut page missing: ${path.relative(DIST, pf)}`); return; }
        const h = fs.readFileSync(pf, "utf8");
        rowsPerFile(h, seen);
        if (h.length > 1.2e6) fail(`${path.relative(DIST, pf)}: ${(h.length / 1e6).toFixed(2)} MB of HTML (budget 1.2 MB, docs/CONTRACT-render.md)`);
      });
    }
    let want = 0, bad = [];
    for (const b of EC.guideBundles(d)) {
      const n = Object.keys(EC.loadBundle(b).series).length;
      want += n;
      if ((seen.get(b) ?? 0) !== n) bad.push(`${b} ${seen.get(b) ?? 0}/${n}`);
    }
    for (const b of seen.keys()) if (!EC.guideBundles(d).includes(b)) bad.push(`${b} is not a bundle of this guide`);
    // Data and downloads: every bundle of the registry entry (and every file a family claims)
    // downloads from the guide page, or from its family's view one click away
    const unreachable = [];
    for (const b of new Set([d.currentBundle, ...(d.bundles ?? []), ...EC.guideBundles(d)])) {
      if (!b || !fs.existsSync(path.join(ROOT, "data/series", b + ".json"))) continue;
      if (html.includes(`/data/${b}.csv`)) continue;
      const fam = plan.tails.find((t) => t.kind === "family" && t.bundles.includes(b));
      const fp = fam && path.join(DIST, "guides", d.slug, "every-cut", fam.id, "index.html");
      const ok1 = fam && html.includes(`/guides/${d.slug}/every-cut/${fam.id}/`) && fs.existsSync(fp) && fs.readFileSync(fp, "utf8").includes(`/data/${b}.csv`);
      if (!ok1) unreachable.push(b);
    }
    if (unreachable.length) fail(`/guides/${d.slug}/: ${unreachable.length} file(s) not downloadable from the guide page or one click away: ${unreachable.slice(0, 5).join(", ")}`);
    else ok(`/guides/${d.slug}/: every file downloads from the page or one click away`);
    if (bad.length) fail(`/guides/${d.slug}/: every-cut does not list each series exactly once: ${bad.slice(0, 5).join("; ")}${bad.length > 5 ? ` (+${bad.length - 5})` : ""}`);
    else ok(`/guides/${d.slug}/: every-cut lists all ${want} series once (${plan.inlineRows.length} inline${plan.tails.length ? `, ${plan.tails.length} long-tail view${plan.tails.length > 1 ? "s" : ""}` : ""})`);
  }
}

// deep archive links (docs/PLAN-launch.md §2b): every "Finer detail" link on a built page points at
// a folder of the archive that data/archive/manifest.json lists, and every guide whose bundles
// have archive tables rolling up to them carries the link
{
  const AR = await import(pathToFileURL(path.join(ROOT, "src/dossiers/archive.js")).href);
  const EC = await import(pathToFileURL(path.join(ROOT, "src/dossiers/everycut.js")).href);
  const man = AR.archiveManifest();
  const listed = [...(man.tables ?? []).map((t) => t.path), ...Object.values(man.raw ?? {}).flatMap((r) => r.files.map(([rel]) => r.hf_prefix + rel))];
  const base = AR.ARCHIVE_URL + "/tree/main/";
  let links = 0, bad = 0;
  const pages = [];
  (function walk(dir) { for (const e of fs.readdirSync(dir, { withFileTypes: true })) { const p = path.join(dir, e.name); if (e.isDirectory()) walk(p); else if (e.name === "index.html") pages.push(p); } })(path.join(DIST, "guides"));
  for (const p of pages) {
    const h = fs.readFileSync(p, "utf8");
    for (const m of h.matchAll(/class="archive-link" href="([^"]+)"/g)) {
      links++;
      const href = m[1].replace(/&amp;/g, "&");
      const rel = href.startsWith(base) ? href.slice(base.length) : null;
      if (!rel || !listed.some((x) => x === rel || x.startsWith(rel + "/"))) { bad++; fail(`${path.relative(DIST, p)}: archive link ${href} is not a path in data/archive/manifest.json`); }
    }
  }
  for (const d of DOSSIERS) {
    const f = path.join(DIST, "guides", d.slug, "index.html");
    if (!fs.existsSync(f)) continue;
    const h = fs.readFileSync(f, "utf8");
    for (const b of EC.guideBundles(d)) {
      const a = AR.archiveFor(b);
      if (a && !h.includes(`href="${a.href}"`)) fail(`/guides/${d.slug}/: ${b} has ${a.tables} archive tables and the page does not link them`);
    }
  }
  if (!bad) ok(`archive links: ${links} on ${pages.length} pages, all to paths in the manifest (${(man.tables ?? []).length} table files)`);
}

// file sizes and site search (docs/CONTRACT-render.md, "Budgets"): no file in dist over 20 MB
// (Cloudflare Pages refuses 25 MiB); the search core within its gzipped budget, every shard and
// chunk within 1 MB; and a sample of series from every guide found through the shards by their
// own label, each result opening a page that carries the row's anchor once
{
  const FILE_MAX = 20e6, CORE_GZ_MAX = 500 * 1024, SHARD_MAX = 1024 * 1024, PER_GUIDE = 12;
  const zlib = await import("node:zlib");
  let largest = ["", 0], over = 0, nFiles = 0;
  (function walk(dir) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) { walk(p); continue; }
      const sz = fs.statSync(p).size; nFiles++;
      if (sz > largest[1]) largest = [p, sz];
      if (sz > FILE_MAX) { over++; fail(`${path.relative(DIST, p)} is ${(sz / 1e6).toFixed(1)} MB; no file may pass 20 MB (Cloudflare Pages refuses 25 MiB)`); }
    }
  })(DIST);
  if (!over) ok(`file sizes: ${nFiles} files in dist, largest ${path.relative(DIST, largest[0])} at ${(largest[1] / 1e6).toFixed(1)} MB (limit 20 MB)`);

  const SD = path.join(DIST, "search");
  const coreFile = path.join(SD, "core.json");
  if (!fs.existsSync(coreFile)) fail("site search: dist/search/core.json missing (scripts/search-index.mjs runs after astro build)");
  else {
    const coreGz = zlib.gzipSync(fs.readFileSync(coreFile), { level: 9 }).length;
    if (coreGz > CORE_GZ_MAX) fail(`site search: core.json is ${(coreGz / 1024).toFixed(0)} KB gzipped, over its ${CORE_GZ_MAX / 1024} KB budget`);
    let bigShard = 0, nShard = 0;
    for (const sub of ["t", "r"]) for (const f of fs.readdirSync(path.join(SD, sub))) {
      const sz = fs.statSync(path.join(SD, sub, f)).size; nShard++; bigShard = Math.max(bigShard, sz);
      if (sz > SHARD_MAX) fail(`site search: ${sub}/${f} is ${(sz / 1024).toFixed(0)} KB, over 1 MB`);
    }
    const core = JSON.parse(fs.readFileSync(coreFile, "utf8"));
    const nAll = core.bundles.reduce((a, b) => a + b[5], 0);
    if (nAll !== core.nSeries) fail(`site search: bundles hold ${nAll} rows, core says ${core.nSeries}`);
    const SC = await import(pathToFileURL(path.join(ROOT, "src/dossiers/search-core.js")).href);
    const S = SC.createSearch(core, async (p) => JSON.parse(fs.readFileSync(path.join(SD, p), "utf8")));
    let tried = 0, missed = 0;
    const pageCache = new Map();
    const page = (url) => { if (!pageCache.has(url)) { const f = path.join(DIST, url, "index.html"); pageCache.set(url, fs.existsSync(f) ? fs.readFileSync(f, "utf8") : null); } return pageCache.get(url); };
    for (let g = 0; g < core.guides.length; g++) {
      const ids = core.bundles.filter((b) => b[3] === g).flatMap((b) => Array.from({ length: b[5] }, (_, k) => b[4] + k));
      if (!ids.length) { fail(`site search: guide ${core.guides[g][0]} has no series in the index`); continue; }
      const pick = [...new Set(Array.from({ length: Math.min(PER_GUIDE, ids.length) }, (_, k) => ids[Math.floor((k + 0.5) * ids.length / Math.min(PER_GUIDE, ids.length))]))];
      const rows = await S.rowsAt(pick);
      for (const id of pick) {
        tried++;
        const row = rows.get(id);
        const c = await S.candidates(row[0] + " ");
        const found = c && c.ids.includes(id) && (!c.deferred.has(id) || S.passes(row, c.words.filter((w) => c.looseWords.includes(w.w))));
        if (!found) { missed++; fail(`site search: "${row[0]}" (${core.guides[g][0]}) is not found by its own label`); continue; }
        const d = S.describe(id, row);
        const [url, anchor] = d.href.split("#");
        if (!anchor) { if (!fs.existsSync(path.join(DIST, url))) { missed++; fail(`site search: "${row[0]}" links to ${url}, which dist lacks`); } continue; }
        const h = page(url);
        const n = h ? h.split(`id="${anchor}"`).length - 1 : 0;
        if (n !== 1) { missed++; fail(`site search: "${row[0]}" links to ${d.href}; the page carries that anchor ${n} times`); }
      }
    }
    if (coreGz <= CORE_GZ_MAX && bigShard <= SHARD_MAX && !missed)
      ok(`site search: core ${(coreGz / 1024).toFixed(0)} KB gzipped (budget ${CORE_GZ_MAX / 1024} KB), ${nShard} shards and chunks, largest ${(bigShard / 1024).toFixed(0)} KB; ${tried} sampled series across ${core.guides.length} guides all found by their label and opened on their row`);
  }
}

// ---- profiles (lb/profiles): the state profiles, /states/<state>/ --------------------------
// Every unit in the state key has a page and a CSV; every figure on every profile and on the
// index (<b class="fig" data-f data-src>) is re-read here from its bundle by an evaluator of
// this gate's own and rendered through the profiles' formats; no figure sits in a sentence,
// cell or number block without a period; pages stay inside the HTML budget. The charts of five
// profiles of different shapes run through the PAGES harness above (and lint-charts).
{
  const { STATES } = await import(pathToFileURL(path.join(ROOT, "src/dossiers/states-key.js")).href);
  const { FMT: PF } = await import(pathToFileURL(path.join(ROOT, "src/dossiers/profiles.fmt.js")).href);
  const B = (slug) => bundles[slug];
  const at = (b, k, iso) => { const x = B(b), i = x.dates.indexOf(iso); if (i < 0) throw new Error(`${b} has no date ${iso}`); if (!x.series[k]) throw new Error(`${b} has no series ${k}`); return x.series[k].data[i]; };
  const EVAL = {
    cell: ({ args: [[b, k]], iso }) => at(b, k, iso),
    sum: ({ args, iso }) => args.reduce((a, [b, k]) => a + at(b, k, iso), 0),
    growth: ({ args: [[b, k]], iso }) => { const x = B(b), i = x.dates.indexOf(iso); return (x.series[k].data[i] / x.series[k].data[i - 1] - 1) * 100; },
    ratio: ({ args: [[b1, k1], [b2, k2, sc = 1]], iso }) => (at(b1, k1, iso) / (at(b2, k2, iso) * sc)) * 100,
    mean: ({ args: [[b, k, from, to]] }) => { const x = B(b); const v = x.dates.map((d, i) => (d >= from && d <= to ? x.series[k].data[i] : null)).filter((y) => y != null); return v.reduce((a, y) => a + y, 0) / v.length; },
    nfhsIndia: ({ args: [[b, re]] }) => Object.values(B(b).series).find((s) => s.geo === "All India" && s.sector === "total" && new RegExp(re).test(s.group ?? "")).data[0],
    scale: ({ args: [[b, k, f]], iso }) => at(b, k, iso) * f,
    plus100: ({ args: [[b, k]], iso }) => 100 + at(b, k, iso),
    sum12: ({ args: [[b, k]], iso }) => { const x = B(b), i = x.dates.indexOf(iso); return x.series[k].data.slice(i - 11, i + 1).reduce((a, v) => a + v, 0); },
    yoy12: ({ args: [[b, k]], iso }) => { const p = `${+iso.slice(0, 4) - 1}${iso.slice(4)}`; return (at(b, k, iso) / at(b, k, p) - 1) * 100; },
    ratioSum: ({ args: [num, den], iso }) => (num.reduce((a, [b, k]) => a + at(b, k, iso), 0) / den.reduce((a, [b, k]) => a + at(b, k, iso), 0)) * 100,
  };
  const unesc = (t) => t.replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
  let nFig = 0, bad = 0, pages = 0;
  const PERIOD = /\b(19|20)\d{2}\b/;
  const urls = ["/states/", ...STATES.map((u) => `/states/${u.slug}/`)];
  for (const url of urls) {
    const file = path.join(DIST, url, "index.html");
    if (!fs.existsSync(file)) { fail(`profiles: ${url} not built`); continue; }
    const html = fs.readFileSync(file, "utf8");
    pages++;
    if (html.length > 1e6) fail(`profiles: ${url} is ${(html.length / 1e6).toFixed(2)} MB of HTML (budget 1 MB)`);
    const dom = new JSDOM(html);
    for (const el of dom.window.document.querySelectorAll("b.fig")) {
      nFig++;
      const f = el.getAttribute("data-f"), src = JSON.parse(el.getAttribute("data-src"));
      let want;
      try { want = PF[f](EVAL[src.op](src)); } catch (e) { bad++; fail(`profiles: ${url} figure "${el.textContent}": ${e.message}`); continue; }
      if (el.textContent !== want) { bad++; fail(`profiles: ${url} rendered "${el.textContent}" != data "${want}" (${JSON.stringify(src)})`); }
      // its rank: "highest" or "lowest" only for the first and last five places (lb/profiles)
      const rk = /(\d+)(st|nd|rd|th) (highest|lowest) of/.exec(el.closest("p, tr, .num, li")?.textContent ?? "");
      if (rk && +rk[1] > 5) { bad++; fail(`profiles: ${url} says "${rk[0]}": a middle place reads as an extreme`); }
      // its period: in the same sentence, cell or number block
      const box = el.closest("p, tr, .num, li") ?? el.parentElement;
      const cap = el.closest("table")?.querySelector("caption")?.textContent ?? "";   // a table dated once, in its caption
      if (!PERIOD.test(box.textContent.replace(el.textContent, "")) && !PERIOD.test(cap)) { bad++; fail(`profiles: ${url} figure "${el.textContent}" carries no period`); }
    }
    if (url !== "/states/" && !fs.existsSync(path.join(DIST, url.replace(/\/$/, "") + ".csv"))) fail(`profiles: ${url.replace(/\/$/, "")}.csv not built`);
  }
  if (!bad) ok(`profiles: ${pages} pages, ${nFig} figures each re-read from its bundle and dated`);
  // site search: a state's name, in the spellings readers type, returns its profile first
  const corePath = path.join(DIST, "search/core.json");
  if (fs.existsSync(corePath)) {
    const { createSearch } = await import(pathToFileURL(path.join(ROOT, "src/dossiers/search-core.js")).href);
    const S = createSearch(JSON.parse(fs.readFileSync(corePath, "utf8")), async () => ({}));
    let miss = 0;
    for (const [q, slug] of [["Bihar", "bihar"], ["Orissa", "odisha"], ["Pondicherry", "puducherry"], ["NCT of Delhi", "delhi"], ["Jammu and Kashmir", "jammu-kashmir"], ["Uttaranchal", "uttarakhand"]]) {
      const r = S.quick(q).states ?? [];
      if (!(r[0]?.lead && r[0].href === `/states/${slug}/`)) { miss++; fail(`profiles: site search "${q}" does not lead with /states/${slug}/`); }
    }
    if (!miss) ok("profiles: site search leads with the profile for a state's name in six spellings");
  } else fail("profiles: dist/search/core.json missing");
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
