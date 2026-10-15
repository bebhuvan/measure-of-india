// design-mocks/v6/gen.mjs: three landing concepts and the guide, on one 12-column grid with a
// 4px baseline. node design-mocks/v6/gen.mjs -> a-almanac.html, b-cover.html, c-sheet.html, guide.html
// Mocks, not the site: SVGs are drawn here by hand. Every figure is read from data/series.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DOSSIERS } from "../../src/dossiers/registry.js";
import { HEADLINE, SPARK, headlineOf, sparkOf, bundle } from "../../src/dossiers/headline.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const M3 = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const mon = (d) => `${M3[+d.slice(5, 7) - 1]} ${d.slice(0, 4)}`;
const monL = (d) => `${MONTHS[+d.slice(5, 7) - 1]} ${d.slice(0, 4)}`;

// ---------- the grid: 1184 wide, 12 columns of 76.67, 24 gutters ----------
const W = 1184, G = 24, CW = (W - 11 * G) / 12;
const colX = (i) => i * (CW + G);            // left edge of column i (0-based)
const colR = (i) => colX(i) + CW;            // right edge of column i
const MAIN = colX(3), END = colR(10);         // plots run columns 4 to 11; column 12 holds end labels

// ---------- data ----------
const keyOf = (slug) => (HEADLINE[slug].value.toString().match(/last\(b,\s*"([^"]+)"\)/) || [])[1];
function history(d) {
  const sp = SPARK[d.slug];
  if (sp.rounds || sp.slope) { const s = sparkOf(d); return { dates: s.dates, values: s.values, b: null }; }
  const k = keyOf(d.slug), cur = bundle(d.currentBundle);
  const b = sp.bundle && sp.series === k && bundle(sp.bundle).meta.frequency === cur.meta.frequency ? bundle(sp.bundle) : cur;
  const s = b.series[k]; if (!s) { const s2 = sparkOf(d); return { dates: s2.dates, values: s2.values, b: null }; }
  const dates = [], values = [];
  b.dates.forEach((dt, i) => { if (s.data[i] != null) { dates.push(dt); values.push(s.data[i]); } });
  return { dates, values, b, k };
}
const fmtLike = (d, h, v) => { if (!h.b || v == null) return null; try { return HEADLINE[d.slug].value({ ...h.b, series: { ...h.b.series, [h.k]: { ...h.b.series[h.k], data: [v] } } }); } catch { return null; } };
function sinceText(h, freq) {
  const { values: vs, dates: ds } = h, n = vs.length, v = vs.at(-1);
  if (n < 3) return n === 2 ? "Two survey rounds" : "One survey round";
  const med = [...vs].sort((a, b) => a - b)[Math.floor(n / 2)], hiSide = v >= med;
  let j = -1; for (let i = n - 2; i >= 0; i--) if (hiSide ? vs[i] >= v : vs[i] <= v) { j = i; break; }
  const lab = (dt) => (freq === "monthly" || freq === "quarterly" ? mon(dt) : dt.slice(0, 4));
  if (j === -1) return `${hiSide ? "Highest" : "Lowest"} since the series began in ${ds[0].slice(0, 4)}`;
  if (j >= n - 3) return null;
  return `${hiSide ? "Highest" : "Lowest"} since ${lab(ds[j])}`;
}
const G_ALL = DOSSIERS.map((d) => { const hl = headlineOf(d), h = history(d), freq = hl.bundle.meta.frequency;
  const n = h.values.length, last = h.dates.at(-1);
  const ya = (() => { const t = `${+last.slice(0, 4) - 1}${last.slice(4)}`; const i = h.dates.indexOf(t); return i >= 0 ? h.values[i] : null; })();
  return { d, hl, h, freq, fast: freq === "monthly" || freq === "quarterly",
    prev: n > 1 ? fmtLike(d, h, h.values[n - 2]) : null, yago: freq === "monthly" || freq === "quarterly" ? fmtLike(d, h, ya) : null,
    lo: fmtLike(d, h, Math.min(...h.values)), hi: fmtLike(d, h, Math.max(...h.values)), since: sinceText(h, freq) }; });
const FAST_ORDER = ["cpi", "wpi", "gdp", "iip", "jobs", "credit", "rates", "trade", "external", "payments", "public-finance", "banks", "debt", "housing", "markets", "mnre", "climate"];
const FAST = FAST_ORDER.map((s) => G_ALL.find((g) => g.d.slug === s));
const SLOW = G_ALL.filter((g) => !g.fast);

// range strip: every earlier reading a tick, the median a dark tick, the latest the blue dot
function strip(h, w, hgt = 24) {
  const vs = h.values, n = vs.length, cy = hgt / 2;
  let s = `<svg class="strip" viewBox="0 0 ${w} ${hgt}" width="${w}" height="${hgt}" aria-hidden="true"><line x1="5" x2="${w - 5}" y1="${cy}" y2="${cy}" stroke="var(--grid-2)"/>`;
  if (n < 2) return s + `<circle cx="${w / 2}" cy="${cy}" r="4.5" fill="var(--accent)" stroke="var(--bg)" stroke-width="2"/></svg>`;
  const lo = Math.min(...vs), hi = Math.max(...vs), X = (v) => 5 + ((v - lo) / (hi - lo || 1)) * (w - 10);
  const op = n > 200 ? 0.3 : n > 60 ? 0.5 : 0.85;
  for (const v of vs.slice(0, -1)) s += `<line x1="${X(v).toFixed(1)}" x2="${X(v).toFixed(1)}" y1="${cy - 5}" y2="${cy + 5}" stroke="var(--tick)" stroke-opacity="${op}"/>`;
  const med = [...vs].sort((a, b) => a - b)[Math.floor(n / 2)];
  s += `<line x1="${X(med)}" x2="${X(med)}" y1="${cy - 8}" y2="${cy + 8}" stroke="var(--ink-soft)"/>`;
  return s + `<circle cx="${X(vs.at(-1))}" cy="${cy}" r="4.5" fill="var(--accent)" stroke="var(--bg)" stroke-width="2"/></svg>`;
}

// ---------- the CPI line on the 2024 base ----------
const cpiB = bundle("cpi-2024-linked");
const cpiPts = cpiB.dates.map((d, i) => ({ d, v: cpiB.series.headline.data[i] })).filter((q) => q.d >= "2014-01-01");
const cpiL = cpiPts.at(-1);
function yTicks(lo, hi, step) { const t = []; for (let v = Math.ceil(lo / step) * step; v <= hi + 1e-9; v += step) t.push(+v.toFixed(6)); return t; }
function cpiSVG({ h, narrow, onInk }) {
  const pts = cpiPts, w = narrow ? 358 : W, x0 = narrow ? 28 : MAIN, x1 = narrow ? 304 : END, top = 16, bot = h - 28, lo = 0, hi = 10;
  const t0 = Date.parse(pts[0].d), t1 = Date.parse(pts.at(-1).d);
  const X = (d) => x0 + ((Date.parse(d) - t0) / (t1 - t0)) * (x1 - x0), Y = (v) => bot - ((v - lo) / (hi - lo)) * (bot - top);
  const c = onInk ? { band: "var(--f-band)", grid: "var(--f-grid)", zero: "var(--f-zero)", soft: "var(--f-soft)", line: "var(--f-deep)", tgt: "var(--f-deep)" }
                  : { band: "var(--band)", grid: "var(--grid)", zero: "var(--zero)", soft: "var(--accent-soft)", line: "var(--accent)", tgt: "var(--ink-soft)" };
  let s = `<svg class="${onInk ? "on-field" : ""}" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img" aria-label="Consumer price inflation, year on year, ${mon(pts[0].d)} to ${mon(cpiL.d)}, ending at ${cpiL.v.toFixed(1)}%">`;
  s += `<rect x="${x0}" y="${Y(6)}" width="${x1 - x0}" height="${Y(2) - Y(6)}" fill="${c.band}"/>`;
  for (const v of yTicks(lo, hi, 2)) { s += `<line x1="${x0}" x2="${x1}" y1="${Y(v)}" y2="${Y(v)}" stroke="${v ? c.grid : c.zero}"/><text x="${x0 - (narrow ? 6 : G)}" y="${Y(v) + 4}" text-anchor="end" class="ax">${v}${v === hi ? "%" : ""}</text>`; }
  s += `<line x1="${x0}" x2="${x1}" y1="${Y(4)}" y2="${Y(4)}" stroke="${c.tgt}" stroke-dasharray="2 3"/>`;
  const clear = (xa, wd, ya) => pts.every((q) => X(q.d) < xa - 6 || X(q.d) > xa + wd + 6 || Y(q.v) < ya - 17 || Y(q.v) > ya + 9);
  const spot = (wd, ys) => { for (const ya of ys) for (let xa = x1 - wd - 8; xa > x0 + 4; xa -= 4) if (clear(xa, wd, ya)) return [xa, ya]; return null; };
  const tl = "RBI target, 4%", ts = spot(tl.length * 6.4, [Y(4) + 16, Y(4) - 7]); if (ts) s += `<text x="${ts[0]}" y="${ts[1]}" class="lab">${tl}</text>`;
  if (!narrow) { const bl = "Tolerance band, 2 to 6%", bs = spot(bl.length * 6.2, [Y(2) - 7, Y(6) + 16]); if (bs) s += `<text x="${bs[0]}" y="${bs[1]}" class="ax">${bl}</text>`; }
  const y0 = 2014, y1 = +cpiL.d.slice(0, 4);
  for (let y = y0; y <= y1; y += narrow ? 4 : 2) { const d = `${y}-01-01`; s += `<text x="${X(d)}" y="${bot + 20}" text-anchor="middle" class="ax">${y === y0 || narrow ? y : "’" + String(y).slice(2)}</text>`; }
  const pth = (arr) => arr.map((q, i) => `${i ? "L" : "M"}${X(q.d).toFixed(1)},${Y(q.v).toFixed(1)}`).join("");
  const i = pts.findIndex((q) => q.d >= "2025-01-01");
  s += `<path d="${pth(pts.slice(0, i + 1))}" fill="none" stroke="${c.soft}" stroke-width="2" stroke-linejoin="round"/>`;
  s += `<path d="${pth(pts.slice(i))}" fill="none" stroke="${c.line}" stroke-width="2.5" stroke-linejoin="round"/>`;
  if (!narrow) s += `<line x1="${X("2025-01-01")}" x2="${X("2025-01-01")}" y1="${top}" y2="${bot}" stroke="${c.zero}"/><text x="${X("2025-01-01") - 8}" y="${top + 4}" text-anchor="end" class="ax">NSO back-cast</text><text x="${X("2025-01-01") + 8}" y="${top + 4}" class="ax">Live print</text>`;
  s += `<circle cx="${X(cpiL.d)}" cy="${Y(cpiL.v)}" r="4.5" fill="var(--accent)" stroke="${onInk ? "var(--f-field)" : "#fff"}" stroke-width="2"/><text x="${X(cpiL.d) + 10}" y="${Y(cpiL.v) + 4}" class="val">${cpiL.v.toFixed(1)}%</text>`;
  return s + "</svg>";
}

// ---------- concept C: the sheet. Every monthly and quarterly figure on one time axis ----------
function sheetSVG(narrow) {
  const from = "2016-01-01", rowH = narrow ? 64 : 56, padT = 28, rows = FAST, h = padT + rows.length * rowH + 8, w = narrow ? 358 : W;
  const x0 = narrow ? 0 : MAIN, x1 = narrow ? 300 : END, t0 = Date.parse(from), t1 = Date.parse("2026-10-01");
  const X = (d) => x0 + ((Date.parse(d) - t0) / (t1 - t0)) * (x1 - x0);
  let s = `<svg viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img" aria-label="Seventeen monthly and quarterly figures from 2016, each on its own scale">`;
  for (let y = 2016; y <= 2026; y += narrow ? 2 : 1) { const xx = X(`${y}-01-01`); s += `<line x1="${xx}" x2="${xx}" y1="${padT - 6}" y2="${padT - 2}" stroke="var(--tick)"/><text x="${xx}" y="${padT - 12}" text-anchor="middle" class="ax">${y === 2016 || narrow ? y : "’" + String(y).slice(2)}</text>`; }
  rows.forEach((g, r) => {
    const top = padT + r * rowH, lineTop = top + (narrow ? 26 : 8), lineBot = top + rowH - 8;
    const pts = g.h.dates.map((d, i) => ({ d, v: g.h.values[i] })).filter((q) => q.d >= from);
    if (!pts.length) return;
    const vs = pts.map((q) => q.v), lo = Math.min(...vs), hi = Math.max(...vs), Y = (v) => lineBot - ((v - lo) / (hi - lo || 1)) * (lineBot - lineTop);
    s += `<line x1="${narrow ? 0 : 0}" x2="${w}" y1="${top + rowH}" y2="${top + rowH}" stroke="var(--rule)"/>`;
    const cut = pts.findIndex((q) => Date.parse(q.d) >= Date.parse(pts.at(-1).d) - 365 * 864e5);
    const pth = (arr) => arr.map((q, i) => `${i ? "L" : "M"}${X(q.d).toFixed(1)},${Y(q.v).toFixed(1)}`).join("");
    s += `<path d="${pth(pts.slice(0, cut + 1))}" fill="none" stroke="var(--ink-soft)" stroke-width="1.25" stroke-linejoin="round"/>`;
    s += `<path d="${pth(pts.slice(cut))}" fill="none" stroke="var(--accent)" stroke-width="2" stroke-linejoin="round"/>`;
    const L = pts.at(-1); s += `<circle cx="${X(L.d)}" cy="${Y(L.v)}" r="3.5" fill="var(--accent)" stroke="#fff" stroke-width="1.5"/>`;
    if (narrow) { s += `<text x="0" y="${top + 16}" class="rn">${esc(g.d.title)}</text><text x="${w}" y="${top + 16}" text-anchor="end" class="rv">${esc(g.hl.value)}</text>`; }
    else {
      s += `<text x="0" y="${top + rowH / 2 + 1}" class="rn">${esc(g.d.title)}</text><text x="0" y="${top + rowH / 2 + 17}" class="rp">${esc(g.hl.period)}</text>`;
      s += `<text x="${W}" y="${top + rowH / 2 + 5}" text-anchor="end" class="rv">${esc(g.hl.value)}</text>`;
    }
  });
  return s + "</svg>";
}

// ---------- states as tiles ----------
const stB = bundle("cpi-2024-states");
const TILE = { jammu_and_kashmir: ["JK", 0, 2], ladakh: ["LA", 0, 3], punjab: ["PB", 1, 2], himachal_pradesh: ["HP", 1, 3], chandigarh: ["CH", 2, 1], haryana: ["HR", 2, 2], uttarakhand: ["UK", 2, 3],
  rajasthan: ["RJ", 3, 1], nct_of_delhi: ["DL", 3, 2], uttar_pradesh: ["UP", 3, 3], bihar: ["BR", 3, 4], sikkim: ["SK", 3, 5], arunachal_pradesh: ["AR", 3, 7],
  gujarat: ["GJ", 4, 1], madhya_pradesh: ["MP", 4, 2], chhattisgarh: ["CG", 4, 3], jharkhand: ["JH", 4, 4], west_bengal: ["WB", 4, 5], assam: ["AS", 4, 6], nagaland: ["NL", 4, 7],
  the_dadra_and_nagar_haveli_and_daman_and_diu: ["DH", 5, 0], maharashtra: ["MH", 5, 1], telangana: ["TS", 5, 2], odisha: ["OD", 5, 4], tripura: ["TR", 5, 5], meghalaya: ["ML", 5, 6], manipur: ["MN", 5, 7],
  goa: ["GA", 6, 1], karnataka: ["KA", 6, 2], andhra_pradesh: ["AP", 6, 3], mizoram: ["MZ", 6, 6], lakshadweep: ["LD", 7, 0], kerala: ["KL", 7, 2], tamil_nadu: ["TN", 7, 3], puducherry: ["PY", 7, 4], andaman_and_nicobar_islands: ["AN", 7, 6] };
const pretty = (s) => s.replace(/\bAnd\b/g, "and").replace(/^The /, "").replace("NCT of Delhi", "Delhi");
const stRows = Object.entries(stB.series).map(([k, s]) => ({ name: pretty(s.label), v: s.data.at(-1), t: TILE[k] }));
const TINT = ["#EEF1FC", "#DDE3FA", "#C6D0F6", "#A9B7F1", "#8B9DEB"], tint = (v) => TINT[[3, 4, 5, 6].filter((x) => v >= x).length];
function tilesSVG(size) {
  const g = 4, w = 8 * (size + g) - g;
  let s = `<svg viewBox="0 0 ${w} ${w}" width="${w}" height="${w}" role="img" aria-label="Consumer price inflation by state, ${monL(stB.dates.at(-1))}">`;
  for (const r of stRows) { const [c, row, col] = r.t, x = col * (size + g), y = row * (size + g);
    s += `<g><title>${esc(r.name)}, ${r.v.toFixed(1)}%</title><rect x="${x}" y="${y}" width="${size}" height="${size}" fill="${tint(r.v)}"/><text x="${x + 7}" y="${y + 16}" class="tc">${c}</text><text x="${x + 7}" y="${y + size - 8}" class="tv">${r.v.toFixed(1)}</text></g>`; }
  return s + "</svg>";
}
const ranked = [...stRows].sort((a, b) => b.v - a.v);
const rankList = (arr) => arr.map((r) => `<li><span>${esc(r.name)}</span><span>${r.v.toFixed(1)}%</span></li>`).join("");

// ---------- chrome ----------
const latestMonth = cpiL.d;
const prints = FAST.filter((g) => g.hl.asOf === latestMonth && g.freq === "monthly");
const page = (title, cls, body) => `<!doctype html><html lang="en-IN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title><link rel="stylesheet" href="v6.css"></head><body class="${cls}">${body}
<footer class="foot"><div class="wrap grid"><p class="c-m wordmark-s">India Atlas</p><p class="c-x">Every figure on this site is read from an official release and traced to it, and revised as each figure is released.</p></div></footer>
<script>if(location.search.includes("grid"))document.body.classList.add("show-grid")</script></body></html>`;
const masthead = (on, inverse) => `<header class="mast${inverse ? " inverse" : ""}">
  <div class="wrap mast-top"><span>Sunday 11 October 2026</span><span class="mast-next"><span class="dot" aria-hidden="true"></span>Next print: September's consumer prices, about 12 October</span></div>
  <div class="wrap mast-in"><a class="wordmark" href="#">India Atlas</a>
  <nav class="nav">${["Guides", "States", "Learn", "Indicators", "Method", "About"].map((n) => `<a href="#"${n === on ? ' aria-current="page"' : ""}>${n}</a>`).join("")}</nav>
  <button class="find">Search 11,49,750 series<kbd>/</kbd></button></div></header>`;
const actions = `<div class="acts" role="group" aria-label="Chart actions"><span class="acts-l">Download</span><button>PNG</button><button>SVG</button><button>CSV</button><span class="acts-sep" aria-hidden="true"></span><button>Copy link</button><button>Embed</button></div>`;

const statesBlock = `<section class="wrap grid blk">
  <p class="c-m label">States and union territories</p>
  <div class="c-x"><h2 class="h2">Thirty-six economies, one page each</h2><p class="sub">Consumer price inflation in ${monL(stB.dates.at(-1))}, year on year, per cent. Tiles sit roughly where each state lies; each opens its profile.</p></div>
  <figure class="c-tiles"><div class="d">${tilesSVG(60)}</div><div class="p">${tilesSVG(40)}</div>
    <figcaption class="st-key">${["Under 3", "3 to 4", "4 to 5", "5 to 6", "6 and over"].map((l, i) => `<span><i style="background:${TINT[i]}"></i>${l}</span>`).join("")}</figcaption></figure>
  <div class="c-ranks"><h3 class="label">Fastest</h3><ol class="ranks">${rankList(ranked.slice(0, 5))}</ol><h3 class="label">Slowest</h3><ol class="ranks">${rankList(ranked.slice(-5).reverse())}</ol><a class="more" href="#">All 36 profiles</a></div>
</section>`;

const says = [
  "On the 2024 base, headline inflation was 4.8% in Aug 2026, up 0.3 points from July's 4.5%, 0.8 points above the 4% target, and the seventh straight rise since January's 2.7%. Food and beverages ran at 5.7% and transport at 4.6%; restaurants and accommodation services, at 8.4%, spent a third month above the 6% ceiling; and the highest of the twelve divisions, personal care at 15.2%, carries gold, which answers to world prices: a spectator rather than a domestic story.",
  "The climb is genuine; its breadth is not: three divisions sit above the headline and nine below, health, the lowest at 1.3%, has been under the 2% floor for seven prints, and only paan, tobacco and intoxicants moved against the print, down 0.1 points. Rural inflation was 5.2% against urban 4.3%, and inside each the pattern repeats: personal care at 16.0% rural and 14.1% urban, health at 1.3% in both.",
];
const notSay = "December 2025's 1.3% is the retired 2012 base's last reading: a different ruler, not an earlier step on the same one. The 2024 base publishes no component weights, so no core index can be computed on it. What it cannot show is whether underlying pressure is easing, because the instrument for that question does not exist here. We do not know.";

// ================= v6: family colours on grounds, never on marks =================
const FAMILY = { Prices: "prices", Output: "output", Enterprises: "output", Money: "money", External: "external",
  Labour: "people", Work: "people", Consumption: "people", Households: "people", Social: "people", Health: "people", Education: "people",
  Energy: "land", Environment: "land" };
const FAM_NAME = { prices: "Prices", output: "Output and enterprise", money: "Money and markets", external: "India and the world", people: "People and work", land: "Land, food and energy" };
const fam = (d) => (d.slug === "farms" ? "land" : FAMILY[d.section] ?? "output");

// a cover's chart for any guide: the last ten years of its headline, in the family's deep ink
function coverChart(g, w, h, narrow) {
  const pts0 = g.h.dates.map((d, i) => ({ d, v: g.h.values[i] }));
  const cutoff = `${+g.h.dates.at(-1).slice(0, 4) - 10}${g.h.dates.at(-1).slice(4)}`;
  const pts = pts0.filter((q) => q.d >= cutoff);
  if (pts.length < 3) return "";
  const x0 = narrow ? 30 : 48, x1 = w - (narrow ? 56 : 72), top = 12, bot = h - 24;
  const vs = pts.map((q) => q.v); let lo = Math.min(...vs), hi = Math.max(...vs); const pad = (hi - lo) * 0.08; lo -= pad; hi += pad;
  const t0 = Date.parse(pts[0].d), t1 = Date.parse(pts.at(-1).d), X = (d) => x0 + ((Date.parse(d) - t0) / (t1 - t0 || 1)) * (x1 - x0), Y = (v) => bot - ((v - lo) / (hi - lo || 1)) * (bot - top);
  const fmt = (v) => fmtLike(g.d, g.h, v) ?? v.toFixed(1);
  let s = `<svg class="on-field" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img" aria-label="${esc(g.d.title)}, the last ten years">`;
  const vmin = Math.min(...vs), vmax = Math.max(...vs);
  for (const v of [vmin, vmax]) s += `<line x1="${x0}" x2="${x1}" y1="${Y(v)}" y2="${Y(v)}" stroke="var(--f-grid)"/><text x="${x0 - 8}" y="${Y(v) + 4}" text-anchor="end" class="ax">${esc(fmt(v)).replace(/ (crore|lakh crore|GW|bn|times|million tonnes)$/, "")}</text>`;
  if (vmin < 0 && vmax > 0) s += `<line x1="${x0}" x2="${x1}" y1="${Y(0)}" y2="${Y(0)}" stroke="var(--f-zero)"/>`;
  const y0 = +pts[0].d.slice(0, 4), yl = +pts.at(-1).d.slice(0, 4);
  for (const y of [y0 + 1, Math.round((y0 + yl) / 2), yl]) { const d = `${y}-01-01`; if (Date.parse(d) < t0) continue; s += `<text x="${X(d)}" y="${bot + 18}" text-anchor="middle" class="ax">${y}</text>`; }
  s += `<path d="${pts.map((q, i) => `${i ? "L" : "M"}${X(q.d).toFixed(1)},${Y(q.v).toFixed(1)}`).join("")}" fill="none" stroke="var(--f-deep)" stroke-width="1.75" stroke-linejoin="round"/>`;
  const L = pts.at(-1); s += `<circle cx="${X(L.d)}" cy="${Y(L.v)}" r="4.5" fill="var(--accent)" stroke="var(--f-field)" stroke-width="2"/>`;
  return s + "</svg>";
}
const famOf = (slug) => fam(G_ALL.find((g) => g.d.slug === slug).d);

// the shelf: every guide a flat, square-cornered cover in its family's colour
const shelfOrder = ["prices", "output", "money", "external", "people", "land"];
const shelf = shelfOrder.flatMap((f) => G_ALL.filter((g) => fam(g.d) === f)).map((g) => `<a class="book" data-fam="${fam(g.d)}" href="#">
  <span class="b-fam">${esc(FAM_NAME[fam(g.d)])}</span><span class="b-title">${esc(g.d.title)}</span>
  <span class="b-foot"><span class="b-val">${esc(g.hl.value)}</span><span class="b-what">${esc(g.hl.what)}, ${esc(g.hl.period)}</span></span></a>`).join("");

// the sheet, grouped by family, with the family's swatch in the margin
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const NOT_PULSES = new Set(["payments", "public-finance", "mnre"]); // steady climbs or a fiscal-year sawtooth: they do not read as pulses
const FAST6 = shelfOrder.flatMap((f) => FAST.filter((g) => fam(g.d) === f && !NOT_PULSES.has(g.d.slug)));
function sheet6(narrow) {
  const from = "2016-01-01", rowH = narrow ? 64 : 52, padT = 28, h = padT + FAST6.length * rowH + 8, w = narrow ? 358 : W;
  const x0 = narrow ? 0 : MAIN, x1 = narrow ? 300 : END, t0 = Date.parse(from), t1 = Date.parse("2026-10-01"), X = (d) => x0 + ((Date.parse(d) - t0) / (t1 - t0)) * (x1 - x0);
  let s = `<svg viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img" aria-label="Seventeen monthly and quarterly figures from 2016, each on its own scale">`;
  for (let y = 2016; y <= 2026; y += narrow ? 2 : 1) { const xx = X(`${y}-01-01`); s += `<line x1="${xx}" x2="${xx}" y1="${padT - 6}" y2="${padT - 2}" stroke="var(--tick)"/><text x="${xx}" y="${padT - 12}" text-anchor="middle" class="ax">${y === 2016 || narrow ? y : "’" + String(y).slice(2)}</text>`; }
  s += `<line x1="${x0}" x2="${x1}" y1="${padT - 6}" y2="${padT - 6}" stroke="var(--zero)"/>`;
  FAST6.forEach((g, r) => {
    const top = padT + r * rowH, lineTop = top + (narrow ? 26 : 8), lineBot = top + rowH - 8, f = fam(g.d);
    const pts = g.h.dates.map((d, i) => ({ d, v: g.h.values[i] })).filter((q) => q.d >= from); if (!pts.length) return;
    const vs = pts.map((q) => q.v), lo = Math.min(...vs), hi = Math.max(...vs), Y = (v) => lineBot - ((v - lo) / (hi - lo || 1)) * (lineBot - lineTop);
    const firstOfFam = r === 0 || fam(FAST6[r - 1].d) !== f;
    s += `<line x1="0" x2="${w}" y1="${top + rowH}" y2="${top + rowH}" stroke="var(--rule)"/>`; // the area sits on this rule
    const cut = pts.findIndex((q) => Date.parse(q.d) >= Date.parse(pts.at(-1).d) - 365 * 864e5);
    const pth = (arr) => arr.map((q, i) => `${i ? "L" : "M"}${X(q.d).toFixed(1)},${Y(q.v).toFixed(1)}`).join("");
    // shaded against the series' own average since 2016: darker above it, lighter below; the last twelve months in blue
    const mean = vs.reduce((t, v) => t + v, 0) / vs.length, ym = Y(mean).toFixed(1), id = `r${narrow ? "n" : "w"}${r}`;
    const band = (arr) => `${pth(arr)}L${X(arr.at(-1).d).toFixed(1)},${ym}L${X(arr[0].d).toFixed(1)},${ym}Z`;
    const old = pts.slice(0, cut + 1), yr = pts.slice(cut);
    s += `<clipPath id="${id}a"><rect x="0" y="${top}" width="${w}" height="${(ym - top).toFixed(1)}"/></clipPath><clipPath id="${id}b"><rect x="0" y="${ym}" width="${w}" height="${(top + rowH - ym).toFixed(1)}"/></clipPath>`;
    s += `<g clip-path="url(#${id}a)"><path d="${band(old)}" fill="#E4E7EC"/><path d="${band(yr)}" fill="#D5DDFA"/></g><g clip-path="url(#${id}b)"><path d="${band(old)}" fill="#F3F4F6"/><path d="${band(yr)}" fill="#EDF0FC"/></g>`;
    s += `<path d="${pth(old)}" fill="none" stroke="#8A909C" stroke-width="1" stroke-linejoin="round" stroke-linecap="round"/><path d="${pth(yr)}" fill="none" stroke="var(--accent)" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round"/>`;
    const L = pts.at(-1); s += `<circle cx="${X(L.d)}" cy="${Y(L.v)}" r="3" fill="var(--accent)"/>`;
    // a late start is said in words, so the empty years read as a fact rather than a hole
    if (!narrow && pts[0].d > "2016-06-30") s += `<text x="${(X(pts[0].d) - 8).toFixed(1)}" y="${(Y(pts[0].v) + 4).toFixed(1)}" text-anchor="end" class="ax">from ${MON[+pts[0].d.slice(5, 7) - 1]} ${pts[0].d.slice(0, 4)}</text>`;
    if (narrow) s += `<text x="0" y="${top + 16}" class="rn">${esc(g.d.title)}</text><text x="${w}" y="${top + 16}" text-anchor="end" class="rv">${esc(g.hl.value)}</text>`;
    else s += `<text x="0" y="${top + rowH / 2 + 1}" class="rn">${esc(g.d.title)}</text><text x="0" y="${top + rowH / 2 + 17}" class="rp">${esc(g.hl.period)}</text><text x="${W}" y="${top + rowH / 2 + 5}" text-anchor="end" class="rv">${esc(g.hl.value)}</text>`;
  });
  return s + "</svg>";
}

const FAM_DESC = { prices: "What things cost, and how fast that changes", output: "What India makes, and who makes it", money: "Credit, savings, debt and the price of money", external: "Trade, capital and the balance with the world", people: "Work, spending, schooling and health", land: "Farms, energy, water and climate" };
const cpiFam = famOf("cpi");
const LANDING = page("India Atlas", "v6", `${masthead("")}
<main>
<section class="cover" data-fam="${cpiFam}"><div class="wrap grid">
  <div class="c-m cv-meta"><p class="label">The latest print</p><p>${esc(FAM_NAME[cpiFam])}</p><p>Consumer Price Index, MoSPI, released 12 September 2026</p></div>
  <div class="c-x cv-main"><p class="cv-fig">${cpiL.v.toFixed(1)}<span>%</span></p>
    <p class="cv-claim">Prices in August were 4.8% higher than a year earlier: the seventh rise in a row, and above the RBI's 4% target.</p></div>
  <aside class="cv-prints"><p class="label">Also out for August</p><ol>${prints.filter((g) => g.d.slug !== "cpi").map((g) => `<li><a href="#">${esc(g.d.title)}</a><span>${esc(g.hl.value)}</span></li>`).join("")}</ol></aside>
  <figure class="plot c-full"><div class="d">${cpiSVG({ h: 280, onInk: true })}</div><div class="p">${cpiSVG({ h: 220, narrow: true, onInk: true })}</div></figure>
  <p class="c-x cv-src">Consumer price inflation, year on year, per cent, 2024 base; paler before 2025 is the NSO's back-cast. <a href="#">Read the guide</a></p>
</div></section>

<section class="wrap grid blk">
  <div class="c-m"><p class="label rule-top">The sheet</p><p class="small">Read across for a series, down for a moment.</p></div>
  <div class="c-x"><h2 class="h2">${["Zero","One","Two","Three","Four","Five","Six","Seven","Eight","Nine","Ten","Eleven","Twelve","Thirteen","Fourteen","Fifteen","Sixteen","Seventeen"][FAST6.length]} pulses of the Indian economy, on one sheet</h2><p class="sub">Every monthly and quarterly headline since 2016, each on its own scale and shaded against its own average: darker above it, lighter below. The last twelve months are in blue; the dot is the latest reading.</p></div>
  <figure class="plot c-full"><div class="d">${sheet6(false)}</div><div class="p">${sheet6(true)}</div></figure>
</section>

<section class="wrap grid blk">
  <div class="c-m"><p class="label rule-top">The guides</p><p class="small">${G_ALL.length} guides in six families.</p></div>
  <div class="c-x"><h2 class="h2">Every guide</h2></div>
  <div class="c-full idx">${shelfOrder.map((f) => `<div class="idx-g"><div class="idx-h"><h3 class="idx-f">${esc(FAM_NAME[f])}</h3><p class="idx-d">${FAM_DESC[f]}</p><p class="idx-n">${G_ALL.filter((g) => fam(g.d) === f).length} guides</p></div><ol class="idx-l">${G_ALL.filter((g) => fam(g.d) === f).map((g) => `<li><a href="#">${esc(g.d.title)}</a><span class="idx-v">${esc(g.hl.value)}</span><span class="idx-w">${esc(g.hl.what)}, ${esc(g.hl.period)}</span></li>`).join("")}</ol></div>`).join("")}</div>
</section>
${statesBlock}
</main>`);

// six covers, one per family, as each guide would open
const COVER_PICK = ["cpi", "gdp", "credit", "trade", "jobs", "climate"];
const COVERS = page("Guide covers, India Atlas", "v6", `${masthead("Guides")}
<main class="wrap"><div class="covers">${COVER_PICK.map((slug) => { const g = G_ALL.find((x) => x.d.slug === slug), f = fam(g.d);
  return `<article class="mini" data-fam="${f}"><p class="label">${esc(FAM_NAME[f])}</p><h2 class="mini-t">${esc(g.d.title)}</h2>
  <div class="mini-row"><p class="mini-fig">${esc(g.hl.value)}</p><p class="mini-what">${esc(g.hl.what)}, ${esc(g.hl.period)}</p></div>
  ${coverChart(g, 540, 150)}</article>`; }).join("")}</div>
  <section class="swatches"><h2 class="h2">The six families</h2><p class="sub">Each family has a field (the ground of a cover), a deep tone (type and lines on that field) and a bar tone (the swatch). Charts inside a guide never use them: ultramarine, marigold and grey stay the only colours of data.</p>
  <div class="sw-row">${shelfOrder.map((f) => `<div class="swb" data-fam="${f}"><span class="label">${esc(FAM_NAME[f])}</span><span class="ratio" data-f="${f}"></span></div>`).join("")}</div></section>
</main>`);

// the guide, opening with its cover
const gc = G_ALL.find((x) => x.d.slug === "cpi");
const GUIDE6 = page("Consumer prices, India Atlas", "v6", `${masthead("Guides")}
<main>
<section class="cover g-cover" data-fam="${cpiFam}"><div class="wrap grid">
  <p class="c-full crumb-in"><a href="#">Guides</a><span>/</span><a href="#">${esc(FAM_NAME[cpiFam])}</a><span>/</span><span>Consumer Price Index</span></p>
  <div class="c-m cv-meta"><p class="label">${esc(FAM_NAME[cpiFam])}</p><p>Consumer Price Index</p><p>Monthly, from MoSPI</p></div>
  <div class="c-x"><h1 class="g-h1">The price of a basket of life</h1><p class="lede cv-lede">Every month, the government checks the price of about three hundred things an ordinary household buys, and tells us with a single number how much dearer life has become.</p></div>
  <div class="c-m cv-keys"><p class="cv-fig sm">4.8<span>%</span></p><p class="small">Headline, Aug 2026, up 0.3 pt on July</p></div>
  <figure class="plot c-x bleed cv-plot"><div class="d">${cpiSVG({ h: 260, onInk: true })}</div><div class="p">${cpiSVG({ h: 200, narrow: true, onInk: true })}</div></figure>
  <dl class="c-x facts"><div><dt>Base</dt><dd>2024 = 100</dd></div><div><dt>Latest print</dt><dd>August 2026, released 12 Sep</dd></div><div><dt>Next</dt><dd>About 12 Oct</dd></div></dl>
</div></section>
<section class="wrap grid sec first">
  <div class="c-m r3"><p class="secn"><span>01</span>The current reading</p></div>
  <div class="c-x"><h2 class="h2">Inflation has risen for seven straight months; only three of the twelve divisions sit above it</h2><p class="stamp"><span class="dot" aria-hidden="true"></span>Written for the print of 12 September 2026</p></div>
  <p class="c-m label lab-row">What the print says</p><div class="c-x prose lab-row">${says.map((p) => `<p>${p}</p>`).join("")}</div>
  <p class="c-m label lab-row">What it does not say</p><div class="c-x prose lab-row counter"><p>${notSay}</p></div>
</section>
</main>`);

for (const [f, html] of [["landing-quiet.html", LANDING], ["covers.html", COVERS], ["guide.html", GUIDE6]]) fs.writeFileSync(path.join(HERE, f), html);
console.log("wrote landing, covers, guide;", G_ALL.length, "books");

// ---- v4 final: the white guide cover (the default) and the fresh one (first week after a release) ----
const guideCover = (fresh) => `<section class="${fresh ? "cover" : "wcover"} g-cover" data-fam="${cpiFam}"><div class="wrap grid">
  <p class="c-full crumb-in"><a href="#">Guides</a><span>/</span><a href="#">${esc(FAM_NAME[cpiFam])}</a><span>/</span><span>Consumer Price Index</span>${fresh ? '<span class="fresh-tag"><span class="dot" aria-hidden="true"></span>New print, released 12 September</span>' : ""}</p>
  <div class="c-m cv-meta"><p class="fam-name">${esc(FAM_NAME[cpiFam])}</p><p>Consumer Price Index</p><p>Monthly, from MoSPI</p></div>
  <div class="c-x"><h1 class="g-h1">The price of a basket of life</h1><p class="lede cv-lede">Every month, the government checks the price of about three hundred things an ordinary household buys, and tells us with a single number how much dearer life has become.</p></div>
  <div class="c-m cv-keys"><p class="cv-fig sm">4.8<span>%</span></p><p class="small">Headline, Aug 2026, up 0.3 pt on July</p></div>
  <figure class="plot c-x bleed cv-plot"><div class="d">${cpiSVG({ h: 260, onInk: fresh })}</div><div class="p">${cpiSVG({ h: 200, narrow: true, onInk: fresh })}</div></figure>
  <dl class="c-x facts"><div><dt>Base</dt><dd>2024 = 100</dd></div><div><dt>Latest print</dt><dd>August 2026, released 12 Sep</dd></div><div><dt>Next</dt><dd>About 12 Oct</dd></div></dl>
</div></section>`;
for (const [f, fresh] of [["guide-white.html", false], ["guide-fresh.html", true]])
  fs.writeFileSync(path.join(HERE, f), page("Consumer prices, India Atlas", "v6", `${masthead("Guides")}<main>${guideCover(fresh)}</main>`));
const SW = page("Families, India Atlas", "v6", `${masthead("")}<main class="wrap"><section class="swatches"><h2 class="h2">The six families</h2><p class="sub">Field: the ground of a fresh cover. Deep: type and lines on that field. Bar: the 3 px rule that marks a guide's family on its white cover.</p>
<div class="sw-row">${shelfOrder.map((f) => `<div class="swb" data-fam="${f}"><span class="label">${esc(FAM_NAME[f])}</span><span class="swb-g">Aa 4.8%</span></div>`).join("")}</div></section></main>`);
fs.writeFileSync(path.join(HERE, "families.html"), SW);

// ---- v4.1: just white. Same covers with no family colour; "new print" is the ultramarine dot alone ----
const monoCover = (fresh) => guideCover(false).replace(`data-fam="${cpiFam}"`, 'data-fam="mono"')
  .replace("<span>Consumer Price Index</span></p>", `<span>Consumer Price Index</span>${fresh ? '<span class="fresh-tag"><span class="dot" aria-hidden="true"></span>New print, released 12 September</span>' : ""}</p>`);
fs.writeFileSync(path.join(HERE, "guide-mono.html"), page("Consumer prices, India Atlas", "v6", `${masthead("Guides")}<main>${monoCover(true)}</main>`));
const landingMono = LANDING.replace(`<section class="cover" data-fam="${cpiFam}">`, '<section class="wcover lcover" data-fam="mono">')
  .replaceAll("onInkPLACEHOLDER", "")
  .replace(/<figure class="plot c-full"><div class="d">[\s\S]*?<\/figure>/, `<figure class="plot c-full"><div class="d">${cpiSVG({ h: 280 })}</div><div class="p">${cpiSVG({ h: 220, narrow: true })}</div></figure>`);
fs.writeFileSync(path.join(HERE, "landing-mono.html"), landingMono);
console.log("wrote guide-mono, landing-mono");
