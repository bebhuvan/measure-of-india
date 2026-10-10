#!/usr/bin/env node
// scripts/og.mjs — renders each dossier's OG card (1200×630 PNG, white bg):
// brand line, dossier title, and a simplified rendering of Plate 1.
// Output: public/og/<slug>.png (picked up by astro build) — run before astro build.

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";
import sharp from "sharp";
import wawoff2 from "wawoff2";
import { DOSSIERS, bySlug, kicker } from "../src/dossiers/registry.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// Rendering fonts: librsvg (via sharp) uses fontconfig, so install TTFs
// converted from the site's self-hosted woff2 into the user font dir.
// Idempotent; works the same on a clean CI runner.
async function ensureFonts() {
  const dir = path.join(os.homedir(), ".local/share/fonts");
  fs.mkdirSync(dir, { recursive: true });
  for (const f of ["source-serif-4-normal-latin", "golos-text-normal-latin"]) {
    const out = path.join(dir, "india-atlas-" + f + ".ttf");
    if (fs.existsSync(out)) continue;
    const ttf = await wawoff2.decompress(fs.readFileSync(path.join(ROOT, "public/fonts", f + ".woff2")));
    fs.writeFileSync(out, Buffer.from(ttf));
  }
}
// the converted fontsource faces register under these family names
const RENDER_FAMILY = { "Source Serif 4": "Source Serif 4", "Golos Text": "Golos Text" };
const renderFonts = (svg) =>
  svg.replace(/font-family="([^"]+)"/g, (_, fam) =>
    'font-family="' + fam.split(",").map((f) => RENDER_FAMILY[f.trim().replace(/'/g, "")] ?? f.trim()).join(",") + '"');

// DOM globals for Observable Plot
const dom = new JSDOM("<!DOCTYPE html><body></body>");
for (const k of ["window", "document", "Node", "Element", "HTMLElement", "SVGElement", "XMLSerializer", "getComputedStyle"]) {
  Object.defineProperty(globalThis, k, { value: dom.window[k], configurable: true, writable: true });
}
const Plot = (await import("@observablehq/plot")).default ?? (await import("@observablehq/plot"));

const mono = "'Golos Text', sans-serif";   // chart text face (name kept from v1)
const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const monthOf = (b) => { const d = b.dates.at(-1); return `${MONTHS[+d.slice(5, 7) - 1]} ${d.slice(0, 4)}`; };
const shortHeadline = (S) => { S.headline = { ...S.headline, label: "Inflation" }; };

function dodgeEndLabels(seriesList, gap) {
  const pts = seriesList.map((s) => ({ value: s.data.at(-1).value, y: s.data.at(-1).value, s }));
  pts.sort((a, b) => b.y - a.y);
  for (let i = 1; i < pts.length; i++) if (pts[i - 1].y - pts[i].y < gap) pts[i].y = pts[i - 1].y - gap;
  return pts;
}

function load(slug) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, "data/series", slug + ".json"), "utf8"));
}
function hydrate(bundle) {
  const dates = bundle.dates.map((d) => new Date(d + "T00:00:00Z"));
  const S = {};
  for (const [k, s] of Object.entries(bundle.series)) {
    S[k] = { ...s, data: s.data.map((v, i) => ({ date: dates[i], value: v })) };
  }
  return S;
}

function plotSvg({ S, keys, d0, d1, band, trend, suffix = "%", yStep, fmt, mr }) {
  const W = 1120, H = 400;
  const dates = S[keys[0]].data.map((d) => d.date);
  const fmtV = fmt ?? ((v) => v.toFixed(2) + suffix);
  const yTicks = [];
  const step = yStep ?? (d1 - d0 > 30 ? 10 : 2);
  for (let v = Math.ceil(d0 / step) * step; v <= d1; v += step) yTicks.push(v);
  const marks = [
    Plot.gridY(yTicks, { stroke: "#F0F2F5", strokeWidth: 1 }),
    band ? Plot.rectY([{ y1: band[0], y2: band[1] }], { y1: "y1", y2: "y2", x1: dates[0], x2: dates.at(-1), fill: "#F4F6FD" }) : null,
    Plot.ruleY([d0], { stroke: "#E3E6EB", strokeWidth: 1 }),
    Plot.ruleY([0], { stroke: band ? "#B5BAC4" : "#161A22", strokeOpacity: band ? 1 : 0.55, strokeWidth: 1 }),
    trend != null ? Plot.ruleY([trend], { stroke: "#BFC4CD", strokeWidth: 1, strokeDasharray: "2,4" }) : null,
    ...keys.slice(1).map((k) => Plot.lineY(S[k].data, { x: "date", y: "value", stroke: S[k].color, strokeWidth: 1.5, strokeLinejoin: "round", strokeLinecap: "round", ...(S[k].dashed ? { strokeDasharray: "4 3" } : {}) })),
    Plot.lineY(S[keys[0]].data, { x: "date", y: "value", stroke: S[keys[0]].color, strokeWidth: 2.75, strokeLinejoin: "round", strokeLinecap: "round" }),
    ...keys.map((k) => Plot.dot([S[k].data.at(-1)], { x: "date", y: "value", fill: S[k].color, r: k === keys[0] ? 5 : 3.5, stroke: "#FFFFFF", strokeWidth: 1.5 })),
    ...dodgeEndLabels(keys.map((k) => S[k]), (d1 - d0) * 0.05).map((p) =>
      Plot.text([{ date: p.s.data.at(-1).date, y: p.y }], { x: "date", y: "y", text: () => `${p.s.label} ${fmtV(p.value)}`, dx: 14, fill: "#161A22", fontSize: 15, fontFamily: mono, fontWeight: p.s.label === S[keys[0]].label ? 500 : 400, textAnchor: "start" })),
  ].filter(Boolean);
  const plot = Plot.plot({
    width: W, height: H, marginLeft: 44, marginRight: mr ?? 170, marginTop: 10, marginBottom: 24,
    style: { background: "transparent", fontFamily: mono, fontSize: "12.5px", color: "#5F6675" },
    x: { axis: null },
    y: { axis: null, domain: [d0, d1] },
    marks,
  });
  return new XMLSerializer().serializeToString(plot);
}

// Visual/data config per card. Dossier kicker + title are NOT here — they
// come from src/dossiers/registry.js at render time (single source of truth);
// the "site" card is the only one with local kicker/title.
const CARDS = [
  {
    slug: "site", bundleSlug: "cpi-2024-linked", kicker: "Guides to India's official economic statistics",
    title: "An atlas of the Indian economy.",
    keys: ["headline"], d0: 0, d1: 10, band: [2, 6], trend: 4,
    prep: shortHeadline,
    foot: (b, S) => `Consumer price inflation ${S.headline.data.at(-1).value.toFixed(2)}%, ${monthOf(b)}, base 2024. Source: MoSPI/NSO`,
  },
  {
    slug: "cpi", bundleSlug: "cpi-2024-linked",
    keys: ["headline"], d0: 0, d1: 10, band: [2, 6], trend: 4,
    prep: shortHeadline,
    foot: (b, S) => `Consumer price inflation ${S.headline.data.at(-1).value.toFixed(2)}%, ${monthOf(b)}, base 2024. Source: MoSPI/NSO`,
  },
  {
    slug: "gdp", bundleSlug: "gdp-2022",
    keys: ["gdp", "gva", "pfce"], d0: 0, d1: 12, band: null, trend: null,
    foot: (b, S) => `Real GDP ${S.gdp.data.at(-1).value.toFixed(2)}% y/y · latest quarter · Source: MoSPI/NSO`,
  },
  {
    slug: "wpi", bundleSlug: "wpi",
    keys: ["headline", "primary", "manufactured", "food_index"], d0: -8, d1: 20, band: null, trend: null,
    foot: (b, S) => `Headline WPI ${S.headline.data.at(-1).value.toFixed(2)}% y/y · ${b.meta.latestPeriod} · Source: OEA/DPIIT`,
  },
  {
    slug: "iip", bundleSlug: "iip-2022",
    keys: ["general", "sector_manufacturing", "use_capital_goods"], d0: -5, d1: 18, band: null, trend: null,
    foot: (b, S) => `IIP ${S.general.data.at(-1).value.toFixed(2)}% y/y · ${b.meta.latestPeriod} · Source: MoSPI/NSO · base 2022-23`,
  },
  {
    // external (lb/external): weekly reserves since 2001, RBI DBIE
    slug: "external", bundleSlug: "external-reserves-weekly",
    keys: ["total_usd"], d0: 0, d1: 900, band: null, trend: null, scale: 0.001, yStep: 200, fmt: (v) => "$" + v.toFixed(0) + " bn", mr: 200,
    prep: (S) => { S.total_usd = { ...S.total_usd, label: "Reserves", color: "#2E4BD8" }; },
    foot: (b, S) => `Foreign exchange reserves $${(S.total_usd.data.at(-1).value / 1000).toFixed(0)} bn, week of ${b.dates.at(-1)}. Source: RBI DBIE`,
  },
  {
    slug: "jobs", bundleSlug: "plfs-quarterly",
    keys: ["ur"], d0: 0, d1: 24, band: null, trend: null,
    foot: (b, S) => `Urban unemployment ${S.ur.data.filter((d) => d.value != null).at(-1).value.toFixed(2)}% · ${b.meta.latestPeriod} · Source: MoSPI/NSO`,
  },
  {
    // HCES is cross-sectional: the card plots the 12-class fractile ladder
    // (a real ordering) as the line, rural and urban, 2023-24 round.
    slug: "consumption", bundleSlug: "hces-fractiles",
    keys: ["rural_ladder", "urban_ladder"], d0: 0, d1: 22000, band: null, trend: null,
    yStep: 5000, fmt: (v) => "₹" + Math.round(v).toLocaleString("en-IN"),
    prep: (S) => {
      const FRACS = ["f0_5", "f5_10", "f10_20", "f20_30", "f30_40", "f40_50",
        "f50_60", "f60_70", "f70_80", "f80_90", "f90_95", "f95_100"];
      const ladder = (sector) => FRACS.map((k, i) => ({ date: i, value: S[k + "_" + sector].data[1].value }));
      S.rural_ladder = { label: "Rural", color: "#2E4BD8", data: ladder("rural") };
      S.urban_ladder = { label: "Urban", color: "#5F6675", data: ladder("urban") };
    },
    foot: (b, S) => `MPCE by fractile class · bottom 5% rural ₹${Math.round(S.rural_ladder.data[0].value).toLocaleString("en-IN")}, top 5% urban ₹${Math.round(S.urban_ladder.data.at(-1).value).toLocaleString("en-IN")} · 2023-24 round · Source: MoSPI/NSO`,
  },
  {
    slug: "factories", bundleSlug: "asi-headline",
    keys: ["factories_in_operation", "number_of_factories"], d0: 0, d1: 3.2, band: null, trend: null,
    scale: 1e-5, yStep: 1, fmt: (v) => v.toFixed(2) + " lakh", mr: 240,
    prep: (S) => {
      S.factories_in_operation = { ...S.factories_in_operation, label: "In operation", color: "#2E4BD8" };
      S.number_of_factories = { ...S.number_of_factories, label: "Registered", color: "#5F6675" };
    },
    foot: (b, S) => `Factories in operation ${S.factories_in_operation.data.at(-1).value.toFixed(2)} lakh · ASI 2023-24 · Source: MoSPI/NSO`,
  },
  {
    slug: "aishe", bundleSlug: "aishe-access",
    // in crore: card.scale only touches series that exist before prep, so prep scales its own
    keys: ["female", "male"], d0: 1.6, d1: 2.45, band: null, trend: null,
    yStep: 0.2, fmt: (v) => v.toFixed(2) + " cr", mr: 230,
    prep: (S) => {
      const cr = (s) => s.data.map((d) => ({ ...d, value: d.value == null ? null : d.value / 1e7 }));
      S.female = { ...S.enrolment_female, data: cr(S.enrolment_female), label: "Female", color: "#2E4BD8" };
      S.male = { ...S.enrolment_male, data: cr(S.enrolment_male), label: "Male", color: "#5F6675" };
    },
    foot: (b, S) => `Enrolment ${S.female.data.at(-1).value.toFixed(2)} cr (F) · ${S.male.data.at(-1).value.toFixed(2)} cr (M) · AISHE 2021-22 · Source: Ministry of Education`,
  },
  {
    slug: "gender", bundleSlug: "gender-t007",
    keys: ["total__all_india", "rural__all_india", "urban__all_india"], d0: 870, d1: 940, band: null, trend: null,
    yStep: 10, fmt: (v) => String(Math.round(v)), mr: 220,
    prep: (S) => {
      S.total__all_india = { ...S.total__all_india, label: "India", color: "#2E4BD8" };
      S.rural__all_india = { ...S.rural__all_india, label: "Villages", color: "#A3A9B4" };
      S.urban__all_india = { ...S.urban__all_india, label: "Towns", color: "#5F6675" };
    },
    foot: (b) => `Girls born per 1,000 boys, ${b.meta.periodLabels[b.dates[0]]} to ${b.meta.periodLabels[b.dates.at(-1)]}, three-year averages. Source: SRS, Registrar General`,
  },
  {
    slug: "mnre", bundleSlug: "mnre-sources",
    // the domain is in GW: card.scale turns the bundle's MW into GW before plotting
    keys: ["grand_total"], d0: 50, d1: 300, band: null, trend: null,
    scale: 0.001, yStep: 50, fmt: (v) => v.toFixed(0) + " GW", mr: 200,
    prep: (S) => { S.grand_total = { ...S.grand_total, label: "Grand Total", color: "#2E4BD8" }; },
    foot: (b, S) => `Grand Total ${(S.grand_total.data.at(-1).value).toFixed(0)} GW · ${["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][+b.dates.at(-1).slice(5, 7) - 1]} ${b.dates.at(-1).slice(0, 4)} · the Dec 2023 step is a classification change, not capacity · Source: MNRE`,
  },
  {
    slug: "nfhs", bundleSlug: "nfhs-5-anaemia",
    keys: ["children", "women"], d0: 40, d1: 75, band: null, trend: null,
    yStep: 5, fmt: (v) => v.toFixed(1) + "%", mr: 220,
    // two survey rounds, two bundles: one point from each, drawn as a before-and-after
    prep: (S) => {
      const two = (k) => ["nfhs-4-anaemia", "nfhs-5-anaemia"].map((b) => { const x = load(b); return { date: new Date(x.dates[0] + "T00:00:00Z"), value: x.series[k].data[0] }; });
      S.children = { label: "Children 6-59 months", color: "#2E4BD8", data: two("children_age_6_59_months_who_are_anaemic_11__all_india__total") };
      S.women = { label: "Women 15-49", color: "#5F6675", data: two("all_women_age_15_49_years_who_are_anaemic__all_india__total") };
    },
    foot: (b, S) => `Anaemic, per cent, NFHS-4 (2015-16) and NFHS-5 (2019-21): children ${S.children.data[0].value.toFixed(1)} to ${S.children.data[1].value.toFixed(1)}. Source: IIPS, MoHFW, via MoSPI`,
  },
  {
    slug: "deposits", bundleSlug: "deposits-owners",
    keys: ["household_term", "household_savings", "household_current"], d0: 0, d1: 100, band: null, trend: null,
    yStep: 20, fmt: (v) => "₹" + v.toFixed(1) + " lakh cr", mr: 230,
    prep: (S) => { S.household_term = { ...S.household_term, label: "Fixed deposits" }; S.household_savings = { ...S.household_savings, label: "Savings" }; S.household_current = { ...S.household_current, label: "Current" }; },
    foot: (b, S) => `Household bank deposits, March ${b.dates.at(-1).slice(0, 4)}. Source: RBI, BSR-2`,
  },
  // services: 75 years of services exports and imports (RBI), US$ billion
  {
    slug: "services", bundleSlug: "services-bop-annual",
    keys: ["s1_2_1_credit", "s1_2_1_debit"], d0: 0, d1: 450, band: null, trend: null,
    scale: 0.001, yStep: 100, fmt: (v) => "$" + v.toFixed(0) + " bn", mr: 220,
    prep: (S) => { S.s1_2_1_credit = { ...S.s1_2_1_credit, label: "Exports", color: "#2E4BD8" }; S.s1_2_1_debit = { ...S.s1_2_1_debit, label: "Imports", color: "#C47A16" }; },
    foot: (b) => { const y = +b.dates.at(-1).slice(0, 4); return `Services exports and imports, 1950-51 to ${y}-${String((y + 1) % 100).padStart(2, "0")}. Source: RBI`; },
  },
  // --- states (state economies) ---
  {
    slug: "states", bundleSlug: "states-spread",
    keys: ["gap_current", "gap_constant"], d0: 0, d1: 14, band: null, trend: null,
    yStep: 2, fmt: (v) => v.toFixed(1) + "×", mr: 220,
    prep: (S) => { S.gap_current = { ...S.gap_current, label: "Current prices", color: "#2E4BD8" }; S.gap_constant = { ...S.gap_constant, label: "Constant prices", color: "#A3A9B4" }; },
    foot: (b) => `Richest state's income per person ÷ poorest's, ${b.meta.panel.length} states, 2011-12 to ${(() => { const y = +b.dates.at(-1).slice(0, 4); return `${y}-${String((y + 1) % 100).padStart(2, "0")}`; })()}. Source: MoSPI`,
  },
  // --- rates (atlas-rates) ---
  {
    slug: "rates", bundleSlug: "rates-monthly",
    keys: ["repo", "sdf"], d0: 0, d1: 10, band: null, trend: null,
    yStep: 2, fmt: (v) => v.toFixed(2) + "%", mr: 200,
    prep: (S) => {
      const from = (s) => ({ ...s, data: s.data.filter((d) => d.date >= new Date(Date.UTC(2011, 4, 1))) });
      S.repo = { ...from(S.repo), label: "Repo rate", color: "#2E4BD8" };
      S.sdf = { ...from(S.sdf), label: "SDF (floor)", color: "#A3A9B4" };
    },
    foot: (b) => `RBI policy repo rate at month-end, May 2011 to ${monthOf(b)}. Source: RBI`,
  },
  // credit (lb/credit)
  {
    slug: "credit", bundleSlug: "credit-growth",
    keys: ["headline", "personal_loans", "industry"], d0: -5, d1: 35, band: null, trend: null,
    yStep: 5, fmt: (v) => v.toFixed(1) + "%", mr: 230,
    prep: (S) => { S.headline = { ...S.headline, label: "Bank credit", color: "#2E4BD8" }; S.personal_loans = { ...S.personal_loans, label: "Personal loans", color: "#5F6675" }; S.industry = { ...S.industry, label: "Industry", color: "#A3A9B4" }; },
    foot: (b, S) => { const d = b.dates.at(-1); return `Bank credit growth on a year earlier, ${["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"][+d.slice(5, 7) - 1]} ${d.slice(0, 4)}. Source: RBI, sectoral deployment of bank credit`; },
  },
  // payments (lb/payments): UPI and card payments a month, crore
  {
    slug: "payments", bundleSlug: "payments-monthly",
    keys: ["upi_volume", "cards_volume"], d0: 0, d1: 3000,   // raise d1 when UPI passes 3,000 crore a month
    band: null, trend: null,
    scale: 1e-7, yStep: 500, fmt: (v) => v.toFixed(0) + " crore", mr: 220,
    prep: (S) => { S.upi_volume = { ...S.upi_volume, label: "UPI", color: "#2E4BD8" }; S.cards_volume = { ...S.cards_volume, label: "Cards", color: "#A3A9B4" }; },
    foot: (b) => { const d = b.dates.at(-1); return `Payments a month, crore, November 2019 to ${["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"][+d.slice(5, 7) - 1]} ${d.slice(0, 4)}. Source: RBI, payment system indicators`; },
  },

  {
    slug: "manufacturing", bundleSlug: "wdi-manufacturing",
    keys: ["mva_pct_gdp", "industry_pct_gdp"], d0: 0, d1: 30, band: null, trend: null,
    yStep: 10, fmt: (v) => v.toFixed(1) + "%", mr: 220,
    foot: (b, S) => `Manufacturing ${S.mva_pct_gdp.data.at(-1).value.toFixed(1)}% of GDP · 2025 · Source: World Bank WDI`,
  },
  // ---- bis family session ----
  {
    slug: "debt", bundleSlug: "bis-credit",
    keys: ["households", "companies", "government"], d0: 0, d1: 100, band: null, trend: null,
    yStep: 25, fmt: (v) => v.toFixed(1) + "%", mr: 230,
    prep: (S) => {
      const from = new Date(Date.UTC(2007, 3, 1));
      // households and companies stop at the last measured quarter: BIS estimates the rest with the split frozen
      for (const [k, label, color] of [["households", "Households", "#2E4BD8"], ["companies", "Companies", "#5F6675"], ["government", "Government", "#A3A9B4"]]) {
        const est = new Set((S[k].estimated ?? []).map((d) => new Date(d + "T00:00:00Z").getTime()));
        S[k] = { ...S[k], label, color, data: S[k].data.filter((d) => d.date >= from && !est.has(d.date.getTime())) };
      }
    },
    foot: (b, S) => `Debt, % of GDP, to the last quarter measured. Source: BIS total credit statistics`,
  },
  {
    slug: "housing", bundleSlug: "bis-property",
    keys: ["nominal", "real"], d0: 50, d1: 400, band: null, trend: null,
    yStep: 50, fmt: (v) => v.toFixed(0), mr: 200,
    prep: (S) => { S.nominal = { ...S.nominal, label: "Nominal", color: "#2E4BD8" }; S.real = { ...S.real, label: "Real", color: "#C47A16" }; },
    foot: (b, S) => `Residential property prices, index 2010 = 100, ${b.dates.at(-1).slice(0, 4)} Q${Math.ceil(+b.dates.at(-1).slice(5, 7) / 3)}. Source: BIS`,
  },
  // ---- end bis family ----
  // worldbank family (2026-10-09)
  {
    // the lineup gives the shape; the foot quotes the survey reading
    slug: "poverty", bundleSlug: "poverty-pip-lineup",
    keys: ["headcount_3_00", "headcount_4_20"], d0: 0, d1: 90, band: null, trend: null,
    yStep: 20, fmt: (v) => v.toFixed(1) + "%", mr: 260,
    prep: (S) => {
      const keep = (s) => ({ ...s, data: s.data.filter((d) => d.value != null) });
      S.headcount_3_00 = { ...keep(S.headcount_3_00), label: "$3.00 line, estimate", color: "#2E4BD8" };
      S.headcount_4_20 = { ...keep(S.headcount_4_20), label: "$4.20 line, estimate", color: "#5F6675" };
    },
    foot: (b) => { const s = load("poverty-pip-2022"); return `Share below each line, World Bank estimates to ${b.meta.lastSurveyYear}. Survey reading, HCES ${s.meta.surveys.at(-1).period}: ${s.series.headcount_3_00.data.at(-1).toFixed(1)}% below $3.00. Source: World Bank PIP`; },
  },
  {
    slug: "population", bundleSlug: "population-wpp",
    keys: ["tpopulation1july"], d0: 0, d1: 1.6, band: null, trend: null,
    scale: 1e-6, yStep: 0.4, fmt: (v) => v.toFixed(2) + " bn", mr: 200,
    prep: (S) => { S.tpopulation1july = { ...S.tpopulation1july, label: "Population", color: "#2E4BD8" }; },
    foot: (b, S) => `India's population, UN estimate, ${b.dates.at(-1).slice(0, 4)}: ${S.tpopulation1july.data.at(-1).value.toFixed(3)} billion. Source: UN World Population Prospects 2024`,
  },
  // climate (lb/climate)
  {
    slug: "climate", bundleSlug: "climate-temp-annual",
    keys: ["temperature_anomaly"], d0: -1.5, d1: 1, band: null, trend: null,
    yStep: 0.5, fmt: (v) => (v < 0 ? "−" : "+") + Math.abs(v).toFixed(1) + "°C", mr: 220,
    prep: (S) => { S.temperature_anomaly = { ...S.temperature_anomaly, label: "Against 1991-2020", color: "#2E4BD8" }; },
    foot: (b) => `India's annual temperature against the 1991-2020 average, 1940 to ${b.dates.at(-1).slice(0, 4)}. Source: Copernicus ERA5, via Our World in Data`,
  },
  // ilo
  {
    slug: "ilo", bundleSlug: "ilo-est-eap-2wap",
    keys: ["eap_2wap_sex_age_rt__sex_m__age_ythadult_yge15", "eap_2wap_sex_age_rt__sex_f__age_ythadult_yge15"], d0: 0, d1: 100, band: null, trend: null,
    yStep: 20, fmt: (v) => v.toFixed(1) + "%", mr: 220,
    prep: (S) => {
      S.eap_2wap_sex_age_rt__sex_m__age_ythadult_yge15 = { ...S.eap_2wap_sex_age_rt__sex_m__age_ythadult_yge15, label: "Men", color: "#5F6675" };
      S.eap_2wap_sex_age_rt__sex_f__age_ythadult_yge15 = { ...S.eap_2wap_sex_age_rt__sex_f__age_ythadult_yge15, label: "Women", color: "#2E4BD8" };
    },
    foot: (b) => `Labour force participation, aged 15+, 1990 to ${b.dates.at(-1).slice(0, 4)}, ILO modelled estimates. Source: ILO, ILOSTAT`,
  },
  // --- trade (lb/trade) ---
  {
    slug: "trade", bundleSlug: "trade-total",
    keys: ["exports", "imports"], d0: 0, d1: 90, band: null, trend: null, scale: 1 / 1000,
    yStep: 15, fmt: (v) => "$" + v.toFixed(1) + " bn", mr: 200,
    prep: (S) => { S.exports = { ...S.exports, label: "Exports", color: "#2E4BD8" }; S.imports = { ...S.imports, label: "Imports", color: "#C47A16" }; },
    foot: (b) => { const m = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"][+b.dates.at(-1).slice(5, 7) - 1]; return `India's merchandise exports and imports, monthly, US$ billion, to ${m} ${b.dates.at(-1).slice(0, 4)}. Source: Ministry of Commerce, TradeStat (DGCI&S)`; },
  },
  // --- end trade ---
  // ---- farms (lb/farms): foodgrains, rice and wheat since 1950-51, final estimates ----
  {
    slug: "farms", bundleSlug: "farms-production",
    keys: ["foodgrains", "rice", "wheat"], d0: 0, d1: 400, band: null, trend: null, scale: 1 / 1000,
    yStep: 100, fmt: (v) => v.toFixed(1) + " mt", mr: 220,
    prep: (S) => { S.foodgrains = { ...S.foodgrains, label: "Foodgrains", color: "#2E4BD8" }; S.rice = { ...S.rice, label: "Rice", color: "#5F6675" }; S.wheat = { ...S.wheat, label: "Wheat", color: "#C47A16" }; },
    foot: (b) => { const y = +b.dates.at(-1).slice(0, 4); return `Foodgrain, rice and wheat production, million tonnes, 1950-51 to ${y}-${String((y + 1) % 100).padStart(2, "0")}, final estimates. Source: agriculture ministry, via the RBI`; },
  },
  // ---- end farms ----
  // --- banks (lb/banks) ---
  {
    slug: "banks", bundleSlug: "banks-health",
    keys: ["psb_gnpa", "private_gnpa", "all_gnpa"], d0: 0, d1: 16, band: null, trend: null,
    yStep: 4, fmt: (v) => v.toFixed(1) + "%", mr: 230,
    prep: (S) => { S.psb_gnpa = { ...S.psb_gnpa, label: "Public sector banks", color: "#2E4BD8" }; S.private_gnpa = { ...S.private_gnpa, label: "Private sector banks", color: "#C47A16" }; S.all_gnpa = { ...S.all_gnpa, label: "All banks", color: "#161A22" }; },
    foot: (b) => { const d = b.dates.at(-1); return `Banks' bad loans, gross NPAs as a share of advances, every quarter to ${["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"][+d.slice(5, 7) - 1]} ${d.slice(0, 4)}. Source: RBI, DBIE`; },
  },
  // --- end banks ---
  // --- public-finance (lb/public-finance) ---
  {
    slug: "public-finance", bundleSlug: "public-finance-centre-gdp-b2011",
    keys: ["gross_fiscal_deficit", "revenue_deficit"], d0: 0, d1: 10, band: null, trend: null,
    yStep: 2, fmt: (v) => v.toFixed(1) + "%", mr: 230,
    prep: (S) => {
      const acc = (s) => ({ ...s, data: s.data.filter((d) => d.value != null) });   // accounts only: the estimates are not drawn on the card
      S.gross_fiscal_deficit = { ...acc(S.gross_fiscal_deficit), label: "Fiscal deficit", color: "#2E4BD8" };
      S.revenue_deficit = { ...acc(S.revenue_deficit), label: "Revenue deficit", color: "#A3A9B4" };
    },
    foot: (b) => { const f = b.meta.stages.accountsTo; return `The Centre's deficits, per cent of GDP (2011-12 base), 2011-12 to ${f}, accounts. Source: RBI, Handbook of Statistics`; },
  },
  // --- end public-finance ---
];

await ensureFonts();
fs.mkdirSync(path.join(ROOT, "public/og"), { recursive: true });

// startup guard: CARDS and the dossier registry must cover each other
// exactly ("site" is the only card that is not a dossier). Dossier card
// kickers/titles come from the registry — drift here is a bug, not a choice.
{
  const cardSlugs = new Set(CARDS.map((c) => c.slug).filter((s) => s !== "site"));
  const noCard = DOSSIERS.map((d) => d.slug).filter((s) => !cardSlugs.has(s));
  const notInRegistry = [...cardSlugs].filter((s) => !bySlug[s]);
  if (noCard.length || notInRegistry.length) {
    throw new Error(
      "og.mjs: CARDS out of sync with src/dossiers/registry.js —" +
      (noCard.length ? ` registry dossiers with no card config: ${noCard.join(", ")};` : "") +
      (notInRegistry.length ? ` card slugs not in the registry: ${notInRegistry.join(", ")};` : ""));
  }
}

for (const card of CARDS) {
  const entry = card.slug === "site" ? null : bySlug[card.slug];
  const kickerText = entry ? kicker(entry) : card.kicker;
  const title = entry ? entry.ogTitle : card.title;
  const bundle = load(card.bundleSlug ?? card.slug);
  const S = hydrate(bundle);
  if (card.scale) for (const k of card.keys) if (S[k]) S[k] = { ...S[k], data: S[k].data.map((d) => ({ ...d, value: d.value == null ? null : d.value * card.scale })) };
  if (S.core) S.core.dashed = true;
  if (card.prep) card.prep(S, bundle);
  const chart = plotSvg({ S, keys: card.keys, d0: card.d0, d1: card.d1, band: card.band, trend: card.trend, suffix: card.suffix, yStep: card.yStep, fmt: card.fmt, mr: card.mr });
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">` +
    `<rect width="1200" height="630" fill="#FFFFFF"/>` +
    `<text x="40" y="58" font-family="'Source Serif 4', serif" font-weight="600" font-size="22" fill="#161A22">India Atlas</text>` +
    `<text x="40" y="100" font-family="'Golos Text', sans-serif" font-size="17" fill="#878D99">${esc(kickerText)}</text>` +
    `<text x="40" y="150" font-family="'Source Serif 4', serif" font-weight="500" font-size="46" letter-spacing="-0.6" fill="#161A22">${esc(title)}</text>` +
    `<g transform="translate(40,180)">${chart.replace(/<\?xml[^>]*\?>/, "").replace(/<svg/, '<svg x="0" y="0"').replace(/width="1120"/, 'width="1120"')}</g>` +
    `<line x1="40" y1="596" x2="1160" y2="596" stroke="#ECEEF2"/>` +
    `<text x="40" y="618" font-family="'Golos Text', sans-serif" font-size="14" fill="#878D99">${esc(card.foot(bundle, S).replace(/ · /g, ", "))}</text>` +
    `<text x="1160" y="618" text-anchor="end" font-family="'Golos Text', sans-serif" font-size="14" fill="#878D99">atlas.thisindianlife.today</text>` +
    `</svg>`;
  const png = await sharp(Buffer.from(renderFonts(svg))).png().toBuffer();
  fs.writeFileSync(path.join(ROOT, "public/og", card.slug + ".png"), png);
  console.log(`og/${card.slug}.png (${(png.length / 1024).toFixed(0)} KB)`);
}
console.log("og cards done");

// --- profiles (lb/profiles): one card per state profile, public/og/states/<slug>.png ---
// One generated template: the unit's name, its kind and region, and four of its headline
// figures, each with its period, read through src/dossiers/profiles.js like the page itself.
{
  const { STATES } = await import("../src/dossiers/states-key.js");
  const { compareRow, glanceMeasures } = await import("../src/dossiers/profiles.js");
  const G = glanceMeasures();
  const dir = path.join(ROOT, "public/og/states");
  fs.mkdirSync(dir, { recursive: true });
  const KIND = { state: "State", "ut-legislature": "Union territory", ut: "Union territory" };
  for (const u of STATES) {
    const r = compareRow(u.slug);
    const cells = r.cells.map((c, i) => c && { label: G[i].label, text: c.text, period: c.period }).filter(Boolean).slice(0, 4);
    const nameSize = u.name.length > 30 ? 40 : u.name.length > 20 ? 50 : 62;
    const cellsSvg = cells.map((c, i) => {
      const x = 40 + i * 282;
      return `<line x1="${x}" y1="330" x2="${x + 250}" y2="330" stroke="#DFE2E8"/>` +
        `<text x="${x}" y="362" font-family="'Golos Text', sans-serif" font-size="17" fill="#878D99">${esc(c.label)}</text>` +
        `<text x="${x}" y="428" font-family="'Source Serif 4', serif" font-weight="300" font-size="50" fill="#161A22">${esc(c.text.replace(/ a day$/, ""))}</text>` +
        `<text x="${x}" y="462" font-family="'Golos Text', sans-serif" font-size="16" fill="#4A5160">${esc(c.period)}</text>`;
    }).join("");
    const svg =
      `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">` +
      `<rect width="1200" height="630" fill="#FFFFFF"/>` +
      `<text x="40" y="58" font-family="'Source Serif 4', serif" font-weight="600" font-size="22" fill="#161A22">India Atlas</text>` +
      `<text x="40" y="100" font-family="'Golos Text', sans-serif" font-size="17" fill="#878D99">${esc(`${KIND[u.kind]} profile, ${u.region}`)}</text>` +
      `<text x="40" y="${150 + nameSize / 2}" font-family="'Source Serif 4', serif" font-weight="500" font-size="${nameSize}" letter-spacing="-0.6" fill="#161A22">${esc(u.name)}</text>` +
      `<text x="40" y="262" font-family="'Golos Text', sans-serif" font-size="19" fill="#4A5160">How it earns, spends, works, borrows, learns and falls ill, against India and its neighbours</text>` +
      cellsSvg +
      `<line x1="40" y1="596" x2="1160" y2="596" stroke="#ECEEF2"/>` +
      `<text x="40" y="618" font-family="'Golos Text', sans-serif" font-size="14" fill="#878D99">Each figure with its own period. Sources: MoSPI, RBI, NFHS-5 and others, as named on the page.</text>` +
      `<text x="1160" y="618" text-anchor="end" font-family="'Golos Text', sans-serif" font-size="14" fill="#878D99">atlas.thisindianlife.today/states/${u.slug}/</text>` +
      `</svg>`;
    const png = await sharp(Buffer.from(renderFonts(svg))).png().toBuffer();
    fs.writeFileSync(path.join(dir, u.slug + ".png"), png);
  }
  console.log(`og/states: ${STATES.length} profile cards`);
}
// --- end profiles ---
