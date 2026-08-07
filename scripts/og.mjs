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

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// Rendering fonts: librsvg (via sharp) uses fontconfig, so install TTFs
// converted from the site's self-hosted woff2 into the user font dir.
// Idempotent; works the same on a clean CI runner.
async function ensureFonts() {
  const dir = path.join(os.homedir(), ".local/share/fonts");
  fs.mkdirSync(dir, { recursive: true });
  for (const f of ["archivo-normal", "newsreader-normal", "plex-mono-400", "plex-mono-500"]) {
    const out = path.join(dir, "india-atlas-" + f + ".ttf");
    if (fs.existsSync(out)) continue;
    const ttf = await wawoff2.decompress(fs.readFileSync(path.join(ROOT, "public/fonts", f + ".woff2")));
    fs.writeFileSync(out, Buffer.from(ttf));
  }
}
// the converted fontsource faces register under these family names
const RENDER_FAMILY = { "Archivo": "Archivo SemiBold", "Newsreader": "Newsreader 16pt", "IBM Plex Mono": "IBM Plex Mono" };
const renderFonts = (svg) =>
  svg.replace(/font-family="([^"]+)"/g, (_, fam) =>
    'font-family="' + fam.split(",").map((f) => RENDER_FAMILY[f.trim().replace(/'/g, "")] ?? f.trim()).join(",") + '"');

// DOM globals for Observable Plot
const dom = new JSDOM("<!DOCTYPE html><body></body>");
for (const k of ["window", "document", "Node", "Element", "HTMLElement", "SVGElement", "XMLSerializer", "getComputedStyle"]) {
  Object.defineProperty(globalThis, k, { value: dom.window[k], configurable: true, writable: true });
}
const Plot = (await import("@observablehq/plot")).default ?? (await import("@observablehq/plot"));

const mono = "'IBM Plex Mono', monospace";
const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");

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
    Plot.gridY(yTicks, { stroke: "#EDE9DA", strokeWidth: 1 }),
    band ? Plot.rectY([{ y1: band[0], y2: band[1] }], { y1: "y1", y2: "y2", x1: dates[0], x2: dates.at(-1), fill: "#F8F6F1" }) : null,
    Plot.ruleY([d0], { stroke: "#E0DACA", strokeWidth: 1 }),
    Plot.ruleY([0], { stroke: band ? "#B9B2A1" : "#1B1A17", strokeOpacity: band ? 1 : 0.55, strokeWidth: 1 }),
    trend != null ? Plot.ruleY([trend], { stroke: "#C0B9A6", strokeWidth: 1, strokeDasharray: "2,4" }) : null,
    ...keys.slice(1).map((k) => Plot.lineY(S[k].data, { x: "date", y: "value", stroke: S[k].color, strokeWidth: 1.5, strokeLinejoin: "round", strokeLinecap: "round", ...(S[k].dashed ? { strokeDasharray: "4 3" } : {}) })),
    Plot.lineY(S[keys[0]].data, { x: "date", y: "value", stroke: S[keys[0]].color, strokeWidth: 2.75, strokeLinejoin: "round", strokeLinecap: "round" }),
    ...keys.map((k) => Plot.dot([S[k].data.at(-1)], { x: "date", y: "value", fill: S[k].color, r: k === keys[0] ? 5 : 3.5, stroke: "#FFFFFF", strokeWidth: 1.5 })),
    ...dodgeEndLabels(keys.map((k) => S[k]), (d1 - d0) * 0.05).map((p) =>
      Plot.text([{ date: p.s.data.at(-1).date, y: p.y }], { x: "date", y: "y", text: () => `${p.s.label} ${fmtV(p.value)}`, dx: 14, fill: p.s.color, fontSize: 15, fontFamily: mono, fontWeight: p.s.label === S[keys[0]].label ? 500 : 400, textAnchor: "start" })),
  ].filter(Boolean);
  const plot = Plot.plot({
    width: W, height: H, marginLeft: 44, marginRight: mr ?? 170, marginTop: 10, marginBottom: 24,
    style: { background: "transparent", fontFamily: mono, fontSize: "12.5px", color: "#5C574C" },
    x: { axis: null },
    y: { axis: null, domain: [d0, d1] },
    marks,
  });
  return new XMLSerializer().serializeToString(plot);
}

const CARDS = [
  {
    slug: "site", bundleSlug: "cpi", kicker: "India Atlas · A statistical monograph, continuously revised",
    title: "India's economic data, one dossier at a time.",
    keys: ["headline", "food", "fuel", "core"], d0: -6, d1: 15, band: [2, 6], trend: 4,
    foot: (b, S) => `Headline CPI ${S.headline.data.at(-1).value.toFixed(2)}% · ${b.meta.latestPeriod} · Source: MoSPI/NSO`,
  },
  {
    slug: "cpi", bundleSlug: "cpi", kicker: "Dossier № 01 — Prices · Consumer Price Index",
    title: "The price of a basket of life.",
    keys: ["headline", "food", "fuel", "core"], d0: -6, d1: 15, band: [2, 6], trend: 4,
    foot: (b, S) => `Headline CPI ${S.headline.data.at(-1).value.toFixed(2)}% · ${b.meta.latestPeriod} · Source: MoSPI/NSO`,
  },
  {
    slug: "gdp", bundleSlug: "gdp", kicker: "Dossier № 02 — Output · National Accounts",
    title: "The speed of the whole economy.",
    keys: ["gdp", "gva", "pfce"], d0: -30, d1: 25, band: null, trend: 6,
    foot: (b, S) => `Real GDP ${S.gdp.data.at(-1).value.toFixed(2)}% y/y · latest quarter · Source: MoSPI/NSO`,
  },
  {
    slug: "wpi", bundleSlug: "wpi", kicker: "Dossier № 03 — Prices · Wholesale Price Index",
    title: "The price at the factory gate.",
    keys: ["headline", "primary", "manufactured", "food_index"], d0: -8, d1: 20, band: null, trend: null,
    foot: (b, S) => `Headline WPI ${S.headline.data.at(-1).value.toFixed(2)}% y/y · ${b.meta.latestPeriod} · Source: OEA/DPIIT`,
  },
  {
    slug: "iip", bundleSlug: "iip-2022", kicker: "Dossier № 04 — Output · Index of Industrial Production",
    title: "The monthly pulse of making things.",
    keys: ["general", "sector_manufacturing", "use_capital_goods"], d0: -5, d1: 18, band: null, trend: null,
    foot: (b, S) => `IIP ${S.general.data.at(-1).value.toFixed(2)}% y/y · ${b.meta.latestPeriod} · Source: MoSPI/NSO · base 2022-23`,
  },
  {
    slug: "external", bundleSlug: "rbi-forex", kicker: "Dossier № 05 — External · Balance of Payments",
    title: "What the country earns abroad, and what it owes.",
    keys: ["reserves"], d0: 0, d1: 750, band: null, trend: null, scale: 0.001, suffix: " bn",
    foot: (b, S) => `Reserves $${(S.reserves.data.at(-1).value / 1000).toFixed(0)} bn · ${b.meta.latestPeriod} · Source: RBI`,
  },
  {
    slug: "jobs", bundleSlug: "plfs-quarterly", kicker: "Dossier № 06 — Labour · Periodic Labour Force Survey",
    title: "Who has work, who wants it, who is counted.",
    keys: ["ur"], d0: 0, d1: 24, band: null, trend: null,
    foot: (b, S) => `Urban unemployment ${S.ur.data.filter((d) => d.value != null).at(-1).value.toFixed(2)}% · ${b.meta.latestPeriod} · Source: MoSPI/NSO`,
  },
  {
    // HCES is cross-sectional: the card plots the 12-class fractile ladder
    // (a real ordering) as the line, rural and urban, 2023-24 round.
    slug: "consumption", bundleSlug: "hces-fractiles", kicker: "Dossier № 07 — Consumption · Household Consumption Expenditure Survey",
    title: "What India spends, one person at a time.",
    keys: ["rural_ladder", "urban_ladder"], d0: 0, d1: 22000, band: null, trend: null,
    yStep: 5000, fmt: (v) => "₹" + Math.round(v).toLocaleString("en-IN"),
    prep: (S) => {
      const FRACS = ["f0_5", "f5_10", "f10_20", "f20_30", "f30_40", "f40_50",
        "f50_60", "f60_70", "f70_80", "f80_90", "f90_95", "f95_100"];
      const ladder = (sector) => FRACS.map((k, i) => ({ date: i, value: S[k + "_" + sector].data[1].value }));
      S.rural_ladder = { label: "Rural", color: "#BE3E26", data: ladder("rural") };
      S.urban_ladder = { label: "Urban", color: "#5B564B", data: ladder("urban") };
    },
    foot: (b, S) => `MPCE by fractile class · bottom 5% rural ₹${Math.round(S.rural_ladder.data[0].value).toLocaleString("en-IN")}, top 5% urban ₹${Math.round(S.urban_ladder.data.at(-1).value).toLocaleString("en-IN")} · 2023-24 round · Source: MoSPI/NSO`,
  },
  {
    slug: "factories", bundleSlug: "asi-headline", kicker: "Dossier № 08 — Enterprises · Annual Survey of Industries & ASUSE",
    title: "The factory, the shop, and the line between them.",
    keys: ["factories_in_operation", "number_of_factories"], d0: 0, d1: 3.2, band: null, trend: null,
    scale: 1e-5, yStep: 1, fmt: (v) => v.toFixed(2) + " lakh", mr: 240,
    prep: (S) => {
      S.factories_in_operation = { ...S.factories_in_operation, label: "In operation", color: "#BE3E26" };
      S.number_of_factories = { ...S.number_of_factories, label: "Registered", color: "#5B564B" };
    },
    foot: (b, S) => `Factories in operation ${S.factories_in_operation.data.at(-1).value.toFixed(2)} lakh · ASI 2023-24 · Source: MoSPI/NSO`,
  },
];

await ensureFonts();
fs.mkdirSync(path.join(ROOT, "public/og"), { recursive: true });

for (const card of CARDS) {
  const bundle = load(card.bundleSlug ?? card.slug);
  const S = hydrate(bundle);
  if (card.scale) for (const k of card.keys) if (S[k]) S[k] = { ...S[k], data: S[k].data.map((d) => ({ ...d, value: d.value == null ? null : d.value * card.scale })) };
  if (card.bundleSlug === "cpi" || card.slug === "cpi") S.core.dashed = true;
  if (card.prep) card.prep(S, bundle);
  const chart = plotSvg({ S, keys: card.keys, d0: card.d0, d1: card.d1, band: card.band, trend: card.trend, suffix: card.suffix, yStep: card.yStep, fmt: card.fmt, mr: card.mr });
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">` +
    `<rect width="1200" height="630" fill="#FFFFFF"/>` +
    `<rect x="40" y="42" width="10" height="10" fill="#BE3E26"/>` +
    `<text x="60" y="52" font-family="Archivo, sans-serif" font-weight="720" font-size="17" letter-spacing="-0.2" fill="#1B1A17">India Atlas</text>` +
    `<text x="40" y="96" font-family="'IBM Plex Mono', monospace" font-size="11.5" letter-spacing="2.3" fill="#BE3E26">${esc(card.kicker.toUpperCase())}</text>` +
    `<text x="40" y="146" font-family="Archivo, sans-serif" font-weight="720" font-size="44" letter-spacing="-1.2" fill="#1B1A17">${esc(card.title)}</text>` +
    `<g transform="translate(40,180)">${chart.replace(/<\?xml[^>]*\?>/, "").replace(/<svg/, '<svg x="0" y="0"').replace(/width="1120"/, 'width="1120"')}</g>` +
    `<line x1="40" y1="596" x2="1160" y2="596" stroke="#E6E2D6"/>` +
    `<text x="40" y="616" font-family="'IBM Plex Mono', monospace" font-size="12" fill="#8A857A">${esc(card.foot(bundle, S))}</text>` +
    `<text x="1160" y="616" text-anchor="end" font-family="'IBM Plex Mono', monospace" font-size="12" fill="#8A857A">indiaatlas.in</text>` +
    `</svg>`;
  const png = await sharp(Buffer.from(renderFonts(svg))).png().toBuffer();
  fs.writeFileSync(path.join(ROOT, "public/og", card.slug + ".png"), png);
  console.log(`og/${card.slug}.png (${(png.length / 1024).toFixed(0)} KB)`);
}
console.log("og cards done");
