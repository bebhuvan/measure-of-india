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
    keys: ["female", "male"], d0: 1.6, d1: 2.45, band: null, trend: null,
    scale: 1e-7, yStep: 0.2, fmt: (v) => v.toFixed(2) + " cr", mr: 230,
    prep: (S) => {
      S.female = { ...S.enrolment_female, label: "Female", color: "#2E4BD8" };
      S.male = { ...S.enrolment_male, label: "Male", color: "#5F6675" };
    },
    foot: (b, S) => `Enrolment ${S.female.data.at(-1).value.toFixed(2)} cr (F) · ${S.male.data.at(-1).value.toFixed(2)} cr (M) · AISHE 2021-22 · Source: Ministry of Education`,
  },
  {
    slug: "gender", bundleSlug: "gender-sexratio",
    keys: ["sex_ratio"], d0: 920, d1: 950, band: null, trend: null,
    yStep: 5, fmt: (v) => String(Math.round(v)), mr: 200,
    prep: (S) => { S.sex_ratio = { ...S.sex_ratio, label: "Sex ratio", color: "#2E4BD8" }; },
    foot: (b, S) => `Sex ratio ${Math.round(S.sex_ratio.data.at(-1).value)} ♀/1000♂ · Census 1951-2011 · Source: Census of India`,
  },
  {
    slug: "mnre", bundleSlug: "mnre-sources",
    keys: ["grand_total"], d0: 80000, d1: 300000, band: null, trend: null,
    scale: 0.001, yStep: 50, fmt: (v) => v.toFixed(0) + " GW", mr: 200,
    prep: (S) => { S.grand_total = { ...S.grand_total, label: "Grand Total", color: "#2E4BD8" }; },
    foot: (b, S) => `Grand Total ${(S.grand_total.data.at(-1).value).toFixed(0)} GW · Jun 2026 · the Dec 2023 step is a classification change, not capacity · Source: MNRE`,
  },
  {
    slug: "nfhs", bundleSlug: "nfhs-anaemia",
    keys: ["children", "women"], d0: 40, d1: 75, band: null, trend: null,
    yStep: 5, fmt: (v) => v.toFixed(0) + "%", mr: 220,
    prep: (S) => {
      S.children = { label: "Children", color: "#2E4BD8", data: [{ date: 0, value: 58.4 }, { date: 1, value: 67.1 }] };
      S.women = { label: "Women", color: "#5F6675", data: [{ date: 0, value: 53.0 }, { date: 1, value: 57.0 }] };
    },
    foot: () => `Child anaemia 58% → 67% · NFHS-4 to NFHS-5 · Source: MoSPI / IIPS`,
  },
  {
    slug: "deposits", bundleSlug: "deposits-owners",
    keys: ["household_term", "household_savings", "household_current"], d0: 0, d1: 100, band: null, trend: null,
    yStep: 20, fmt: (v) => "₹" + v.toFixed(1) + " lakh cr", mr: 230,
    prep: (S) => { S.household_term = { ...S.household_term, label: "Fixed deposits" }; S.household_savings = { ...S.household_savings, label: "Savings" }; S.household_current = { ...S.household_current, label: "Current" }; },
    foot: (b, S) => `Household bank deposits, March ${b.dates.at(-1).slice(0, 4)}. Source: RBI, BSR-2`,
  },
  {
    slug: "manufacturing", bundleSlug: "wdi-manufacturing",
    keys: ["mva_pct_gdp", "industry_pct_gdp"], d0: 0, d1: 30, band: null, trend: null,
    yStep: 10, fmt: (v) => v.toFixed(1) + "%", mr: 220,
    foot: (b, S) => `Manufacturing ${S.mva_pct_gdp.data.at(-1).value.toFixed(1)}% of GDP · 2025 · Source: World Bank WDI`,
  },
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
