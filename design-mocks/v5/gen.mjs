// design-mocks/v5/gen.mjs: three landing concepts and the guide, on one 12-column grid with a
// 4px baseline. node design-mocks/v5/gen.mjs -> a-almanac.html, b-cover.html, c-sheet.html, guide.html
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
  const c = onInk ? { band: "rgba(255,255,255,.10)", grid: "rgba(255,255,255,.16)", zero: "rgba(255,255,255,.45)", soft: "rgba(255,255,255,.5)", line: "#fff", tgt: "rgba(255,255,255,.75)" }
                  : { band: "var(--band)", grid: "var(--grid)", zero: "var(--zero)", soft: "var(--accent-soft)", line: "var(--accent)", tgt: "var(--ink-soft)" };
  let s = `<svg class="${onInk ? "on-ink" : ""}" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img" aria-label="Consumer price inflation, year on year, ${mon(pts[0].d)} to ${mon(cpiL.d)}, ending at ${cpiL.v.toFixed(1)}%">`;
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
  s += `<circle cx="${X(cpiL.d)}" cy="${Y(cpiL.v)}" r="4.5" fill="${onInk ? "#fff" : "var(--accent)"}" stroke="${onInk ? "var(--accent)" : "#fff"}" stroke-width="2"/><text x="${X(cpiL.d) + 10}" y="${Y(cpiL.v) + 4}" class="val">${cpiL.v.toFixed(1)}%</text>`;
  return s + "</svg>";
}

// ---------- concept C: the sheet. Every monthly and quarterly figure on one time axis ----------
function sheetSVG(narrow) {
  const from = "2016-01-01", rowH = narrow ? 64 : 56, padT = 28, rows = FAST, h = padT + rows.length * rowH + 8, w = narrow ? 358 : W;
  const x0 = narrow ? 0 : MAIN, x1 = narrow ? 300 : END, t0 = Date.parse(from), t1 = Date.parse("2026-10-01");
  const X = (d) => x0 + ((Date.parse(d) - t0) / (t1 - t0)) * (x1 - x0);
  let s = `<svg viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img" aria-label="Seventeen monthly and quarterly figures from 2016, each on its own scale">`;
  for (let y = 2016; y <= 2026; y += narrow ? 2 : 1) { const xx = X(`${y}-01-01`); s += `<line x1="${xx}" x2="${xx}" y1="${padT - 6}" y2="${h - 8}" stroke="var(--grid)"/><text x="${xx}" y="${padT - 12}" text-anchor="middle" class="ax">${y === 2016 || narrow ? y : "’" + String(y).slice(2)}</text>`; }
  rows.forEach((g, r) => {
    const top = padT + r * rowH, lineTop = top + (narrow ? 26 : 8), lineBot = top + rowH - 8;
    const pts = g.h.dates.map((d, i) => ({ d, v: g.h.values[i] })).filter((q) => q.d >= from);
    if (!pts.length) return;
    const vs = pts.map((q) => q.v), lo = Math.min(...vs), hi = Math.max(...vs), Y = (v) => lineBot - ((v - lo) / (hi - lo || 1)) * (lineBot - lineTop);
    s += `<line x1="${narrow ? 0 : 0}" x2="${w}" y1="${top + rowH}" y2="${top + rowH}" stroke="var(--rule)"/>`;
    if (lo < 0 && hi > 0) s += `<line x1="${x0}" x2="${x1}" y1="${Y(0)}" y2="${Y(0)}" stroke="var(--zero)" stroke-dasharray="1 3"/>`;
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
const page = (title, cls, body) => `<!doctype html><html lang="en-IN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title><link rel="stylesheet" href="v5.css"></head><body class="${cls}">${body}
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

// ================= A. THE ALMANAC: the indicators table is the front page =================
const almRow = (g) => `<tr><th scope="row"><a href="#">${esc(g.d.title)}</a><span>${esc(g.hl.what)}</span></th>
  <td class="n big">${esc(g.hl.value)}</td><td class="n">${esc(g.prev ?? "")}</td><td class="n">${esc(g.yago ?? "")}</td>
  <td class="r">${strip(g.h, Math.round(2 * CW + G))}<span class="ends"><span>${esc(g.lo ?? "")}</span><span>${esc(g.hi ?? "")}</span></span></td>
  <td class="p">${esc(g.hl.period)}${g.since ? `<em>${esc(g.since)}</em>` : ""}</td></tr>`;
const almGroups = (rows) => { const secs = [...new Set(rows.map((g) => g.d.section))]; return secs.map((s) => `<tbody><tr class="grp"><th colspan="6">${esc(s)}</th></tr>${rows.filter((g) => g.d.section === s).map(almRow).join("")}</tbody>`).join(""); };
const almHead = (third) => `<thead><tr><th>Indicator</th><th class="n">Latest</th><th class="n">Previous</th><th class="n">${third}</th><th class="r">Its range, every reading on this ruler</th><th class="p">Period</th></tr></thead>`;
const A = page("India Atlas: the almanac", "concept-a", `${masthead("")}
<main>
<section class="wrap grid a-hero">
  <div class="c-m a-date"><p class="a-day">11</p><p class="a-mon">October 2026</p></div>
  <div class="c-x"><h1 class="a-h1">The Indian economy, in its official figures</h1>
  <p class="a-lede">Thirty-three guides, thirty-six states and union territories, 11,49,750 series, each traced to the release it came from. The latest reading of each, against everything that came before it on the same ruler.</p></div>
</section>
<section class="wrap a-table">
  <table class="alm"><caption>Monthly and quarterly figures</caption>${almHead("A year ago")}${almGroups(FAST)}</table>
  <table class="alm slow"><caption>Annual figures and surveys</caption>${almHead("")}${almGroups(SLOW)}</table>
</section>
${statesBlock}
</main>`);

// ================= B. THE COVER: the newest print takes the front page, on ultramarine =================
const B = page("India Atlas: the cover", "concept-b", `${masthead("", true)}
<main>
<section class="cover"><div class="wrap grid">
  <div class="c-m b-meta"><p class="label">The latest print</p><p>Consumer Price Index, MoSPI</p><p>Released 12 September 2026</p></div>
  <div class="c-x b-main"><p class="b-fig">${cpiL.v.toFixed(1)}<span>%</span></p>
    <p class="b-claim">Prices in August were 4.8% higher than a year earlier, the seventh rise in a row and above the RBI's 4% target.</p></div>
  <aside class="b-prints"><p class="label">Also out for August</p><ol>${prints.filter((g) => g.d.slug !== "cpi").map((g) => `<li><a href="#">${esc(g.d.title)}</a><span>${esc(g.hl.value)}</span></li>`).join("")}</ol></aside>
  <figure class="plot c-full"><div class="d">${cpiSVG({ h: 300, onInk: true })}</div><div class="p">${cpiSVG({ h: 220, narrow: true, onInk: true })}</div></figure>
  <p class="c-x b-src">Consumer price inflation, year on year, per cent, on the 2024 base; paler before 2025 is the NSO's back-cast. <a href="#">Read the guide</a></p>
</div></section>
<section class="wrap grid blk">
  <p class="c-m label">The guides</p>
  <div class="c-x"><h2 class="h2">Every figure, against its own history</h2><p class="sub">The blue dot is the latest reading; each grey tick an earlier one on the same ruler; the dark tick the median.</p></div>
  <div class="c-full lg">${[...new Set(G_ALL.map((g) => g.d.section))].map((s) => `<div class="lg-group"><h3 class="lg-sec">${esc(s)}</h3><ol class="lg-list">${G_ALL.filter((g) => g.d.section === s).map((g) => `<li class="lg-row"><span class="lg-head"><a href="#">${esc(g.d.title)}</a><span>${esc(g.hl.what)}, ${esc(g.hl.period)}</span></span><span class="lg-fig">${esc(g.hl.value)}</span><span class="lg-strip">${strip(g.h, Math.round(3 * CW + 2 * G))}<span class="lg-since">${esc(g.since ?? `${g.h.values.length} readings since ${g.h.dates[0].slice(0, 4)}`)}</span></span></li>`).join("")}</ol></div>`).join("")}</div>
</section>
${statesBlock}
</main>`);

// ================= C. THE SHEET: the whole economy on one sheet, like a chart recorder =================
const C = page("India Atlas: the sheet", "concept-c", `${masthead("")}
<main>
<section class="wrap grid c-hero">
  <div class="c-m"><p class="label">India Atlas</p><p class="small">An atlas of the Indian economy in 33 guides and 36 state profiles, from the official figures.</p></div>
  <div class="c-x"><h1 class="c-h1">Seventeen pulses of the Indian economy, on one sheet</h1>
  <p class="sub">Every monthly and quarterly headline since 2016, each on its own scale; the last twelve months in blue, the latest reading as the dot. Read across for a series, down for a moment.</p></div>
  <figure class="plot c-full sheet-fig"><div class="d">${sheetSVG(false)}</div><div class="p">${sheetSVG(true)}</div></figure>
  <div class="c-x foot-row"><p class="src">Sources: MoSPI, RBI, DGCI&amp;S, Labour Bureau, BIS, MNRE, NHB, OWID. Each line on its guide's current base.</p>${actions}</div>
</section>
${statesBlock}
</main>`);

// ================= the guide, on the same grid =================
const says = [
  "On the 2024 base, headline inflation was 4.8% in Aug 2026, up 0.3 points from July's 4.5%, 0.8 points above the 4% target, and the seventh straight rise since January's 2.7%. Food and beverages ran at 5.7% and transport at 4.6%; restaurants and accommodation services, at 8.4%, spent a third month above the 6% ceiling; and the highest of the twelve divisions, personal care at 15.2%, carries gold, which answers to world prices: a spectator rather than a domestic story.",
  "The climb is genuine; its breadth is not: three divisions sit above the headline and nine below, health, the lowest at 1.3%, has been under the 2% floor for seven prints, and only paan, tobacco and intoxicants moved against the print, down 0.1 points. Rural inflation was 5.2% against urban 4.3%, and inside each the pattern repeats: personal care at 16.0% rural and 14.1% urban, health at 1.3% in both.",
];
const notSay = "December 2025's 1.3% is the retired 2012 base's last reading: a different ruler, not an earlier step on the same one. The 2024 base publishes no component weights, so no core index can be computed on it. What it cannot show is whether underlying pressure is easing, because the instrument for that question does not exist here. We do not know.";
const DIV = [["Personal care, incl. gold", 15.2], ["Restaurants and hotels", 8.4], ["Food and beverages", 5.7], ["Paan, tobacco and intoxicants", 4.7], ["Transport", 4.6], ["Education", 3.7], ["Clothing and footwear", 3.6], ["Furnishings and household equipment", 2.7], ["Housing, water, electricity, gas and fuels", 2.6], ["Information and communication", 2.0], ["Recreation, sport and culture", 1.7], ["Health", 1.3]];
function divSVG(narrow) {
  const rowH = narrow ? 44 : 32, top = 32, h = top + DIV.length * rowH + 28, w = narrow ? 358 : W, x0 = narrow ? 4 : MAIN, x1 = narrow ? 316 : END, X = (v) => x0 + (v / 16) * (x1 - x0);
  let s = `<svg viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img" aria-label="Inflation in the twelve CPI divisions, August 2026">`;
  for (const v of [0, 4, 8, 12, 16]) s += `<line x1="${X(v)}" x2="${X(v)}" y1="${top - 8}" y2="${h - 24}" stroke="${v ? "var(--grid)" : "var(--zero)"}"/><text x="${X(v)}" y="${h - 6}" text-anchor="middle" class="ax">${v}${v === 16 ? "%" : ""}</text>`;
  s += `<line x1="${X(4.8)}" x2="${X(4.8)}" y1="${top - 8}" y2="${h - 24}" stroke="var(--ink-soft)" stroke-dasharray="2 3"/><text x="${X(4.8) + 6}" y="${top - 14}" class="lab">Headline, 4.8%</text>`;
  DIV.forEach(([n, v], i) => { const y = top + i * rowH + (narrow ? 28 : 16), hot = v > 4.8;
    s += narrow ? `<text x="${x0}" y="${y - 13}" class="cat">${esc(n)}</text>` : `<text x="${MAIN - G}" y="${y + 4}" text-anchor="end" class="cat">${esc(n)}</text>`;
    s += `<line x1="${X(0)}" x2="${X(v)}" y1="${y}" y2="${y}" stroke="${hot ? "var(--accent-soft)" : "var(--grid-2)"}"/><circle cx="${X(v)}" cy="${y}" r="5" fill="${hot ? "var(--accent)" : "var(--grey)"}" stroke="#fff" stroke-width="2"/><text x="${X(v) + 10}" y="${y + 4}" class="${i ? "lab" : "val"}">${v.toFixed(1)}%</text>`; });
  return s + "</svg>";
}
const toc = ["The current reading", "The new base", "The new basket, opened up", "The register of series", "What is in the basket", "The headline and its parts", "What this measures", "The parts, one plate each", "The sub-indices", "One index, two Indias", "The spread across states", "The other CPI: farm labourers", "The worker's prices and wage", "How to misread this number"];
const GUIDE = page("Consumer prices, India Atlas", "guide", `${masthead("Guides")}
<main>
<div class="wrap crumb"><a href="#">Guides</a><span>/</span><a href="#">Prices</a><span>/</span><span>Consumer Price Index</span></div>
<section class="wrap grid g-title">
  <div class="c-x g-tx"><p class="label g-fam">Prices</p><h1 class="g-h1">The price of a basket of life</h1>
  <p class="lede">Every month, the government checks the price of about three hundred things an ordinary household buys, and tells us with a single number how much dearer life has become.</p></div>
  <div class="c-m g-keys"><div><p class="small">Headline, Aug 2026</p><p class="fig">4.8<span>%</span></p><p class="small">Up 0.3 pt on July</p></div><div><p class="small">Food and beverages</p><p class="fig">5.7<span>%</span></p><p class="small">Up 0.4 pt on July</p></div></div>
  <dl class="c-x facts"><div><dt>Source</dt><dd>MoSPI, NSO</dd></div><div><dt>Base</dt><dd>2024 = 100</dd></div><div><dt>Retired base</dt><dd>2012 = 100</dd></div><div><dt>Latest print</dt><dd>August 2026</dd></div><div><dt>Released</dt><dd>12 Sep 2026</dd></div><div><dt>Next</dt><dd>About 12 Oct</dd></div></dl>
  <nav class="c-x toc" aria-label="On this page"><ol>${toc.map((t, i) => `<li><a href="#"><span>${String(i + 1).padStart(2, "0")}</span>${esc(t)}</a></li>`).join("")}</ol></nav>
</section>

<section class="wrap grid sec">
  <div class="c-m r3"><p class="secn"><span>01</span>The current reading</p></div>
  <div class="c-x"><h2 class="h2">Inflation has risen for seven straight months; only three of the twelve divisions sit above it</h2><p class="stamp"><span class="dot" aria-hidden="true"></span>Written for the print of 12 September 2026</p></div>
  <div class="c-x reading"><p class="fig xl">4.8<span>%</span></p><div class="reading-r"><p class="small">Headline, August 2026, on the 2024 base</p><svg viewBox="0 0 278 36" width="278" height="36" aria-hidden="true"><rect x="${5 + 268 * 2 / 8}" y="6" width="${268 * 4 / 8}" height="10" fill="var(--band)"/><line x1="5" x2="273" y1="11" y2="11" stroke="var(--zero)"/><line x1="${5 + 268 * 4 / 8}" x2="${5 + 268 * 4 / 8}" y1="2" y2="20" stroke="var(--ink-soft)" stroke-dasharray="2 2"/><circle cx="${5 + 268 * 4.8 / 8}" cy="11" r="5" fill="var(--accent)" stroke="#fff" stroke-width="2"/>${[0, 2, 4, 6, 8].map((v) => `<text x="${5 + 268 * v / 8}" y="34" text-anchor="middle" class="ax">${v}${v === 8 ? "%" : ""}</text>`).join("")}</svg><p class="small">0.8 pt above the 4% target, inside the 2 to 6% band</p></div></div>
  <p class="c-m label lab-row">What the print says</p><div class="c-x prose lab-row">${says.map((p) => `<p>${p}</p>`).join("")}</div>
  <p class="c-m label lab-row">What it does not say</p><div class="c-x prose lab-row counter"><p>${notSay}</p></div>
</section>

<section class="wrap grid sec">
  <div class="c-m r5"><div class="sticky"><p class="secn"><span>02</span>The new base</p><p class="fig">4.8<span>%</span></p><p class="small">August 2026, on a year earlier</p></div></div>
  <div class="c-x"><h2 class="h2">One continuous headline on the new ruler, back to 2014</h2>
  <p class="sub">Headline CPI, year on year, per cent, base 2024 = 100. Paler: the NSO's back-cast. Solid: the live print.</p></div>
  <figure class="plot c-x bleed"><div class="d">${cpiSVG({ h: 440 })}</div><div class="p">${cpiSVG({ h: 260, narrow: true })}</div></figure>
  <div class="c-x foot-row"><details class="src"><summary>Source: MoSPI, NSO, back-cast and live levels on the 2024 base. <span>Method</span></summary><p>The NSO publishes its own back-cast of the new index to 2013 and live levels from 2025; on the same 2024 = 100 base they form one continuous headline, not a cross-base splice.</p></details>${actions}</div>
  <div class="c-x notes"><div><p class="label">How to read this</p><p>The blue line is one continuous headline on the 2024 base. The paler stretch is the NSO's back-cast: a reconstruction of history on the new basket, which the NSO may restate. Read the solid part as fact and the paler part as the NSO's best estimate.</p></div>
  <div class="asof"><p class="label"><span class="dot" aria-hidden="true"></span>As of September 2026</p><p>The headline stands at <b>4.8%</b> in August, having firmed every month since it opened the year at <b>2.7%</b>. The old ruler's last reading was <b>1.3%</b>; where both describe the same years, they part by at most <b>0.3 pt</b>.</p></div></div>
</section>

<section class="wrap grid sec">
  <div class="c-m r2"><p class="secn"><span>03</span>The new basket</p></div>
  <div class="c-x"><h2 class="h2">Three divisions run above the headline; nine run below it</h2><p class="sub">The twelve COICOP-2018 divisions of the 2024 base, year on year, per cent, August 2026.</p></div>
  <figure class="plot c-x bleed"><div class="d">${divSVG(false)}</div><div class="p">${divSVG(true)}</div></figure>
  <div class="c-x foot-row"><details class="src"><summary>Source: MoSPI, release of 12 Sep 2026, base 2024 = 100. <span>Method</span></summary><p>The API serves no division weights, so divisions are a ranked strip, not a weighted split.</p></details>${actions}</div>
</section>
</main>`);

for (const [f, html] of [["a-almanac.html", A], ["b-cover.html", B], ["c-sheet.html", C], ["guide.html", GUIDE]]) fs.writeFileSync(path.join(HERE, f), html);
console.log("wrote 4 pages;", FAST.length, "fast rows,", SLOW.length, "slow rows; MAIN", MAIN.toFixed(1), "END", END.toFixed(1));
