#!/usr/bin/env node
// scripts/lint-kit.mjs: geometry lint for charts drawn by the chart kit (src/kit/), no browser.
// Kit SVGs are explicit (every text has x, y, size, weight and anchor; every stroke is a line or
// an M/L/H/V path), and the kit measures text with the face's own widths (src/kit/metrics.js),
// so text boxes here are the boxes the reader sees, to about a pixel.
//
//   overlap   two texts in one drawing overlap
//   strike    a data stroke (a series, a rule, a leader) crosses a text box; gridlines exempt
//   dot       a text box covers a data dot (a circle) by more than its rim
//   bleed     a text box leaves the drawing
//
// Usage: node scripts/lint-kit.mjs <file.html | URL | dist dir> [...]   (exit 1 on finds)
// With a dist directory, every .html under it is checked.
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { tw, C } from "../src/kit/kit.js";

const GRID = new Set([C.grid, "rgba(255,255,255,.55)"]);
const attr = (tag, k) => { const m = tag.match(new RegExp(`\\s${k}="([^"]*)"`)); return m ? m[1] : null; };
const unesc = (s) => s.replace(/&lt;/g, "<").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, "&");

function texts(svg) {
  const out = [];
  for (const m of svg.matchAll(/<text\b([^>]*)>([^<]*)<\/text>/g)) {
    const a = m[1], t = unesc(m[2]); if (!t.trim()) continue;
    const x = +attr(a, "x"), y = +attr(a, "y"), size = +(attr(a, "font-size") ?? 12), weight = +(attr(a, "font-weight") ?? 400);
    const anchor = attr(a, "text-anchor") ?? "start", w = tw(t, size, weight);
    const x0 = anchor === "middle" ? x - w / 2 : anchor === "end" ? x - w : x;
    const base = attr(a, "dominant-baseline");
    const top = base === "middle" ? y - size * 0.36 : base === "hanging" ? y : y - size * 0.72;
    out.push({ t, x0, x1: x0 + w, y0: top, y1: top + size * 0.94, halo: /halo/.test(attr(a, "class") ?? "") });
  }
  return out;
}
function strokes(svg) {
  const segs = [];
  for (const m of svg.matchAll(/<line\b([^>]*)\/>/g)) {
    const a = m[1], st = attr(a, "stroke"); if (!st || GRID.has(st)) continue;
    segs.push([+attr(a, "x1"), +attr(a, "y1"), +attr(a, "x2"), +attr(a, "y2"), st]);
  }
  for (const m of svg.matchAll(/<path\b([^>]*)\/>/g)) {
    const a = m[1], st = attr(a, "stroke"), fill = attr(a, "fill");
    if (!st || st === "#fff" || st === "none" || GRID.has(st) || (fill && fill !== "none")) continue;
    let cx = 0, cy = 0, sx = 0, sy = 0;
    for (const [, c, nums] of (attr(a, "d") ?? "").matchAll(/([MLHVZ])([^MLHVZ]*)/gi)) {
      const n = nums.trim().split(/[\s,]+/).filter(Boolean).map(Number), C2 = c.toUpperCase();
      if (C2 === "M") { cx = n[0]; cy = n[1]; sx = cx; sy = cy; }
      else if (C2 === "L") { for (let i = 0; i < n.length; i += 2) { segs.push([cx, cy, n[i], n[i + 1], st]); cx = n[i]; cy = n[i + 1]; } }
      else if (C2 === "H") { segs.push([cx, cy, n[0], cy, st]); cx = n[0]; }
      else if (C2 === "V") { segs.push([cx, cy, cx, n[0], st]); cy = n[0]; }
      else if (C2 === "Z") { segs.push([cx, cy, sx, sy, st]); cx = sx; cy = sy; }
    }
  }
  return segs;
}
// does segment (a,b)-(c,d) cross the box? (Liang-Barsky clip)
function hits([ax, ay, bx, by], b) {
  let t0 = 0, t1 = 1; const dx = bx - ax, dy = by - ay;
  for (const [p, q] of [[-dx, ax - b.x0], [dx, b.x1 - ax], [-dy, ay - b.y0], [dy, b.y1 - ay]]) {
    if (p === 0) { if (q < 0) return false; } else { const r = q / p; if (p < 0) { if (r > t1) return false; if (r > t0) t0 = r; } else { if (r < t0) return false; if (r < t1) t1 = r; } }
  }
  return true;
}

// A composed figure (kit panels()) nests each panel as its own <svg x y>: lint each panel in its
// own coordinates, then what is drawn outside them.
export function lintSVG(svg) {
  const inner = [...svg.slice(4).matchAll(/<svg\b[^>]*\sx="[^"]*"[\s\S]*?<\/svg>/g)];
  if (!inner.length) return lintFlat(svg);
  let rest = svg; const finds = [];
  inner.forEach((m, i) => { finds.push(...lintFlat(m[0]).map((f) => `panel ${i + 1}: ${f}`)); rest = rest.replace(m[0], ""); });
  return finds.concat(lintFlat(rest));
}
function lintFlat(svg) {
  const W = +attr(svg.slice(0, 400), "width"), H = +attr(svg.slice(0, 400), "height");
  const T = texts(svg), S = strokes(svg), finds = [];
  const D = [...svg.matchAll(/<circle\b([^>]*)\/>/g)].map((m) => ({ x: +attr(m[1], "cx"), y: +attr(m[1], "cy"), r: +attr(m[1], "r") }));
  const inset = (b, k) => ({ x0: b.x0 + k, x1: b.x1 - k, y0: b.y0 + k, y1: b.y1 - k });
  for (let i = 0; i < T.length; i++) {
    const a = T[i];
    if (a.x0 < -1.5 || a.x1 > W + 1.5 || a.y0 < -2 || a.y1 > H + 2) finds.push(`bleed "${a.t}"`);
    for (let j = i + 1; j < T.length; j++) {
      const b = T[j];
      if (a.x0 < b.x1 - 1 && b.x0 < a.x1 - 1 && a.y0 < b.y1 - 1 && b.y0 < a.y1 - 1) finds.push(`overlap "${a.t}" / "${b.t}"`);
    }
    const box = inset(a, a.halo ? 2 : 1);
    for (const s of S) if (hits(s, box)) { finds.push(`strike "${a.t}" by ${s[4]}`); break; }
    for (const d of D) { const nx = Math.max(box.x0, Math.min(d.x, box.x1)), ny = Math.max(box.y0, Math.min(d.y, box.y1)); if (Math.hypot(nx - d.x, ny - d.y) < d.r - 1.5) { finds.push(`dot "${a.t}" covers a dot at ${Math.round(d.x)},${Math.round(d.y)}`); break; } }
  }
  return finds;
}

export function lintHTML(html, where = "") {
  const out = [];
  let k = 0;
  // a drawing is usually one svg; a plate that sets two charts side by side (payments' pairs)
  // holds several in one drawing, each linted on its own
  for (const m of html.matchAll(/<div class="akf-(wide|mid|phone)"[^>]*>([\s\S]*?)<\/div>(?=<div class="akf-|<\/div>)/g)) {
    k++;
    for (const sv of m[2].matchAll(/<svg[\s\S]*?<\/svg>/g)) for (const f of lintSVG(sv[0])) out.push(`${where} chart ${Math.ceil(k / 3)} (${m[1]}): ${f}`);
  }
  return { charts: Math.ceil(k / 3), finds: out };
}

// kit.json holds drawings (svg strings) and, beside them, hover series and CSV tables
export const kitAsHTML = (json) => Object.values(JSON.parse(json)).filter((v) => typeof v === "string" && v.startsWith("<svg")).map((svg) => `<div class="akf-wide">${svg}</div>`).join("");
async function read(src) {
  if (/^https?:/.test(src)) return [[src, await (await fetch(src)).text()]];
  const st = fs.statSync(src);
  if (st.isFile()) return [[src, fs.readFileSync(src, "utf8")]];
  const files = []; const walk = (d) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) walk(p); else if (p.endsWith(".html") || p.endsWith("kit.json")) files.push(p); } }; walk(src);
  // a built page's wide and mid drawings live in kit.json beside it (src/kit/figure.js)
  return files.map((f) => [f, f.endsWith("kit.json") ? kitAsHTML(fs.readFileSync(f, "utf8")) : fs.readFileSync(f, "utf8")]);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const srcs = process.argv.slice(2);
  if (!srcs.length) { console.error("usage: lint-kit.mjs <file|url|dir> ..."); process.exit(2); }
  let charts = 0, bad = 0;
  for (const s of srcs) for (const [where, html] of await read(s)) {
    const r = lintHTML(html, where); charts += r.charts;
    for (const f of r.finds) { bad++; console.log(f); }
  }
  console.log(`lint-kit: ${charts} charts, ${bad} finds`);
  process.exit(bad ? 1 : 0);
}
