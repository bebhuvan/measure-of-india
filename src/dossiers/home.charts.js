// The front page, drawn at build time with the chart kit: the cover chart (the newest consumer
// price print against the RBI's band), the ledger of the measures that move every month or
// quarter, and the states as equal tiles. Every number is read from the bundles here, rounded
// once to the published precision (src/kit/data.js), so the sentences and the charts agree.
import * as K from "../kit/kit.js";
import { figure } from "../kit/figure.js";
import { pairs, last } from "../kit/data.js";
import { STATES } from "./states-key.js";
import { bySlug } from "./registry.js";
import cpiLinked from "../../data/series/cpi-2024-linked.json";
import cpiStates from "../../data/series/cpi-2024-states.json";
import wpi from "../../data/series/wpi-2022.json";
import gdp from "../../data/series/gdp-2022.json";
import iip from "../../data/series/iip-2022.json";
import plfs from "../../data/series/plfs-monthly.json";
import credit from "../../data/series/credit-growth.json";
import trade from "../../data/series/trade-total.json";
import rates from "../../data/series/rates-monthly.json";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const M3 = MONTHS.map((m) => m.slice(0, 3));
const mname = (d) => MONTHS[+d.slice(5, 7) - 1];
const monthL = (d) => `${mname(d)} ${d.slice(0, 4)}`;
const pct = (v, dp = 1) => K.num(v, { dp, suffix: "%" });
const ORD = ["", "first", "second", "third", "fourth", "fifth", "sixth", "seventh", "eighth", "ninth", "tenth", "eleventh", "twelfth"];
const WORD = ["no", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve"];
const word = (n) => WORD[n] ?? String(n);
const ordinal = (n) => ORD[n] ?? `${n}th`;

// ---------------------------------------------------------------- the cover: consumer prices
const band = bySlug.cpi.bands;   // { floor, target, ceiling }
const LIVE_FROM = "2025-01-01";  // the 2024 base's live print; before it, the agency's back-cast
const cpi = pairs(cpiLinked, "headline", { from: "2014-01-01" });
const live = cpi.filter((p) => p[1] != null);
const now = live.at(-1), prev = live.at(-2);
let above = 0; for (let i = live.length - 1; i >= 0 && live[i][1] > band.target; i--) above++;
let run = 0; const up = now[1] > prev[1];
for (let i = live.length - 1; i > 0 && live[i][1] !== live[i - 1][1] && (live[i][1] > live[i - 1][1]) === up; i--) run++;
const low = live.filter((p) => p[0] >= LIVE_FROM).reduce((a, b) => (b[1] < a[1] ? b : a));

export const COVER = {
  value: K.num(now[1], { dp: 1 }), month: monthL(now[0]),
  delta: `${K.num(now[1] - prev[1], { dp: 1, sign: true })} pt on ${mname(prev[0])}` + (run > 1 ? `; ${up ? "rising" : "falling"} for ${word(run)} months` : ""),
  finding: `Consumer prices were ${pct(now[1])} higher in ${mname(now[0])} than a year earlier, ` + (now[1] > band.target
    ? `above the RBI's ${band.target}% target for the ${ordinal(above)} month running`
    : now[1] < band.floor ? `below the ${band.floor}% floor of the RBI's band` : `inside the RBI's band of ${band.floor} to ${band.ceiling}%`),
  lede: low[0] === now[0] ? `That is the lowest reading since the 2024 basket's live print began in January 2025.`
    : `Inflation has ${now[1] > low[1] ? "climbed back" : "eased"} from ${+low[1].toFixed(1) === 0 ? "close to zero" : pct(low[1])} in ${monthL(low[0])}, the lowest reading since the 2024 basket's live print began in January 2025.`,
  release: cpiLinked.meta.releaseDate,
};

export const cover = () => figure({
  bare: true, file: "india-atlas_cpi_headline_2014-" + now[0].slice(0, 4),
  label: `Consumer price inflation, all India, year on year, January 2014 to ${monthL(now[0])}, on the 2024 base, back-cast before January 2025: ${pct(now[1])} in ${monthL(now[0])}, against the RBI's ${band.target}% target and its band of ${band.floor} to ${band.ceiling}%`,
  draw: (width) => K.line({
    width, height: width < 520 ? 260 : width < 1000 ? 320 : 380, freq: "month", unit: { suffix: "%" }, endDp: 1, endSub: mname(now[0]),
    series: [{ name: "Consumer prices", data: cpi, role: "lead", recon: LIVE_FROM }], nameOnEnd: false,
    band: { from: band.floor, to: band.ceiling, label: `RBI tolerance band, ${band.floor} to ${band.ceiling}%` },
    refs: [{ y: band.target, label: `Target, ${band.target}%` }],
    seam: { t: LIVE_FROM, before: "Back-cast", after: "Live print" },
  }),
});

// ---------------------------------------------------------------- the ledger
// one row per measure that moves every month or quarter; the trend is the last three years
const ROWS = [
  { slug: "cpi", b: cpiLinked, k: "headline", name: "Consumer prices", what: "year on year", unit: "%", freq: "month", ref: band.target },
  { slug: "wpi", b: wpi, k: "headline", name: "Wholesale prices", what: "year on year", unit: "%", freq: "month" },
  { slug: "gdp", b: gdp, k: "gdp", name: "GDP", what: "real, year on year", unit: "%", freq: "quarter" },
  { slug: "iip", b: iip, k: "general", name: "Industrial output", what: "year on year", unit: "%", freq: "month", zero: true },
  { slug: "jobs", b: plfs, k: "ur", name: "Unemployment", what: "age 15 and over", unit: "%", freq: "month" },
  { slug: "credit", b: credit, k: "headline", name: "Bank credit", what: "year on year", unit: "%", freq: "month" },
  { slug: "trade", b: trade, k: "balance", name: "Trade balance", what: "goods, US$ billion", unit: "$bn", freq: "month", zero: true },
  { slug: "rates", b: rates, k: "repo", name: "Repo rate", what: "the RBI's policy rate", unit: "%", freq: "month", dp: 2 },
];
const QLAB = (d) => { const m = +d.slice(5, 7) - 1; return `${M3[m]} to ${M3[(m + 2) % 12]} ${d.slice(0, 4)}`; };
const fmtV = (r, v) => r.unit === "$bn" ? (v < 0 ? "−" : "") + "$" + K.num(Math.abs(v), { dp: 1 }) : K.num(v, { dp: r.dp ?? 1 });

export const LEDGER = ROWS.map((r) => {
  const P = r.unit === "$bn" ? pairs(r.b, r.k, { round: false }).map(([d, v]) => [d, v == null ? null : v / 1000]) : pairs(r.b, r.k);
  const li = P.findLastIndex((p) => p[1] != null), [d, v] = P[li];
  const step = 1, ya = r.freq === "quarter" ? 4 : 12, pv = P[li - step]?.[1] ?? null, yv = P[li - ya]?.[1] ?? null;
  const dp = r.dp ?? 1, diff = pv == null ? null : +(v - pv).toFixed(dp);
  const span = P.slice(Math.max(0, li - (r.freq === "quarter" ? 11 : 35)), li + 1);
  return {
    slug: r.slug, name: r.name, what: r.what, date: d,
    value: fmtV(r, v), suffix: r.unit === "%" ? "%" : "bn",
    change: diff == null ? "–" : diff === 0 ? "unchanged" : `${diff > 0 ? "▲" : "▼"} ${K.num(Math.abs(diff), { dp })}${r.unit === "%" ? " pt" : ""}`,
    yearAgo: yv == null ? "–" : fmtV(r, yv) + (r.unit === "%" ? "%" : ""),
    period: r.freq === "quarter" ? QLAB(d) : `${M3[+d.slice(5, 7) - 1]} ${d.slice(0, 4)}`,
    spark: K.spark(span, { width: 150, height: 34, ref: r.ref, zero: !!r.zero, gaps: true }),
  };
}).sort((a, b) => b.date.localeCompare(a.date));

// ---------------------------------------------------------------- across India
const norm = (s) => s.toLowerCase().replace(/&/g, "and").replace(/[^a-z]/g, "").replace(/^nctof/, "").replace(/^the/, "");
const stDate = cpiStates.dates.at(-1);
export const ST = Object.entries(cpiStates.series).map(([k]) => {
  const s = cpiStates.series[k], key = STATES.find((x) => norm(x.name) === norm(s.label) || norm(x.short ?? "") === norm(s.label));
  const p = last(pairs(cpiStates, k));
  return { name: key?.short ?? key?.name ?? s.label, iso: key?.iso?.slice(3) ?? null, v: p && p[0] === stDate ? p[1] : null };
}).filter((r) => r.v != null).sort((a, b) => b.v - a.v);
export const ACROSS = { month: monthL(stDate), top: ST[0], bottom: ST.at(-1), n: ST.length, unmatched: ST.filter((r) => !r.iso).map((r) => r.name) };
if (ACROSS.unmatched.length) throw new Error(`home: states without a tile: ${ACROSS.unmatched.join(", ")}`);

export const tiles = () => figure({
  bare: true, file: "india-atlas_cpi_states_" + stDate.slice(0, 7),
  label: `Consumer price inflation by state and union territory, ${ACROSS.month}, year on year, each one an equal tile: highest in ${ST[0].name} at ${pct(ST[0].v)}, lowest in ${ST.at(-1).name} at ${pct(ST.at(-1).v)}`,
  data: { cols: ["State or UT", `Year on year, per cent, ${stDate.slice(0, 7)}`], rows: ST.map((r) => [r.name, r.v]) },
  draw: (width) => K.tileMap({ width: Math.min(width, 720), values: Object.fromEntries(ST.map((r) => [r.iso, r.v])), names: Object.fromEntries(ST.map((r) => [r.iso, r.name])), unit: { suffix: "%" }, legendLabel: "Year on year, per cent" }),
});
