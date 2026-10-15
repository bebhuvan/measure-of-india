#!/usr/bin/env node
// scripts/lint-charts.mjs — geometric chart lint, no browser needed.
// Renders every built page's JS in jsdom (same harness as qc.mjs), then
// inspects the SVGs for the failure classes found in the 2026-08 audit:
//
//   collision       an annotation text is struck by a line/rule/link stroke
//   text-overlap    two text marks on one chart overlap each other
//   bleed           a text mark extends past the SVG's own width (end labels
//                   that overflow into the page margin)
//   clip            a line/area mark's vertices sit on the plot frame's top or
//                   bottom edge — suspected data clipped by a narrow y-domain
//   centered-label  a text box sits on top of a dot — the function-dx bug
//                   class (Plot ignores function-valued dx/textAnchor)
//
// Method: jsdom has no layout engine, but Plot's SVG is fully explicit —
// text anchor points come from group/text translate attributes, text-anchor
// from the group, and all chart text is IBM Plex Mono (advance = 0.6em), so
// text boxes are exact up to ~1px. Boxes are shrunk 1.5px before testing so
// only genuine glyph-strikes are flagged; the 4px white halo is meant to
// absorb grazes.
//
// Usage: node scripts/lint-charts.mjs [--page /guides/cpi/] [--width 390]  (exit 1 on finds)
//
// --width sets the viewport the page's scripts see (window.innerWidth). Below 700 px the site's
// Plot (src/charts/plot.js) redraws categorical plates for a phone, names above each row; the
// gates run the lint at the default (desktop) width and again at 390, so both layouts are clean.
// Category names on a phone sit on a white plate (atlas.css g.rowname) that a reference rule
// passes behind: they are exempt from stroke collisions, never from text overlap or bleed.

import fs from "node:fs";
import { awaitChartJobs } from './lib/chart-ready.mjs';
import path from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";
import { DOSSIERS } from "../src/dossiers/registry.js";
import { EXPLAINERS } from "../src/learn/registry.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DIST = process.env.QC_DIST ? path.resolve(process.env.QC_DIST) : path.join(ROOT, "dist");
const ONLY = process.argv.includes("--page") ? process.argv[process.argv.indexOf("--page") + 1] : null;
const VERBOSE = process.argv.includes("--verbose");
const VW = process.argv.includes("--width") ? +process.argv[process.argv.indexOf("--width") + 1] : null;

// every dossier from the registry, every live explainer, and the front page —
// a page added to either registry is linted here automatically
const PAGES = [
  ...DOSSIERS.map((d) => "/guides/" + d.slug + "/"),
  ...EXPLAINERS.filter((e) => e.live).map((e) => "/learn/" + e.slug + "/"),
  "/",
  // profiles (lb/profiles): every state profile
  ...(await import("../src/dossiers/states-key.js")).STATES.map((u) => `/states/${u.slug}/`),
];

const MONO_ADV = 0.6;
const SKIP_GROUP = /axis|grid/i;
const COLLIDE_GROUPS = new Set(["line", "rule", "link"]);

/* ---------- geometry helpers ---------- */
function composePoint(el, x, y) {
  // apply translate() transforms from el's ANCESTORS up to the svg root
  // (el's own coordinates are already local to those transforms)
  let px = x, py = y;
  let node = el.parentNode;
  while (node && node.tagName.toLowerCase() !== "svg") {
    const tr = node.getAttribute && node.getAttribute("transform");
    if (tr) {
      const m = tr.match(/translate\(\s*([-\d.eE+]+)[\s,]+([-\d.eE+]+)\s*\)/);
      if (m) { px += +m[1]; py += +m[2]; }
    }
    node = node.parentNode;
  }
  return [px, py];
}

function fontSizeOf(t) {
  let node = t;
  while (node) {
    const fs = node.style?.fontSize || (node.getAttribute && node.getAttribute("font-size"));
    if (fs) return parseFloat(fs);
    node = node.parentNode;
  }
  return 13;
}

function anchorOf(t) {
  let node = t;
  while (node && node.tagName.toLowerCase() !== "svg") {
    const a = node.getAttribute && node.getAttribute("text-anchor");
    if (a) return a;
    node = node.parentNode;
  }
  return "middle"; // Plot's svg default
}

function textBox(t) {
  const tr = (t.getAttribute("transform") || "").match(/translate\(\s*([-\d.eE+]+)[\s,]+([-\d.eE+]+)\s*\)/);
  if (!tr) return null;
  const [ax, ay] = composePoint(t, +tr[1], +tr[2]);
  const fs = fontSizeOf(t);
  const spans = [...t.querySelectorAll("tspan")];
  const w = Math.max(...(spans.length ? spans : [t]).map(line => line.textContent.length * fs * MONO_ADV));
  const anchor = anchorOf(t);
  const x0 = anchor === "end" ? ax - w : anchor === "middle" ? ax - w / 2 : ax;
  // y attribute: "0.32em" = centred on anchor, "0.71em" = baseline below anchor
  const emAttr = parseFloat(t.getAttribute("y") || "0.32em");
  let baseline = emAttr * fs;
  const baselines = spans.length ? spans.map(line => {
    baseline = line.hasAttribute("y") ? parseFloat(line.getAttribute("y")) * fs : baseline + parseFloat(line.getAttribute("dy") || "0") * fs;
    return ay + baseline;
  }) : [ay + baseline];
  return { x0, x1: x0 + w, y0: Math.min(...baselines) - 0.82 * fs, y1: Math.max(...baselines) + 0.22 * fs, ax, ay };
}

function polylineOf(el) {
  if (el.tagName.toLowerCase() === "line") {
    const p1 = composePoint(el, +el.getAttribute("x1"), +el.getAttribute("y1"));
    const p2 = composePoint(el, +el.getAttribute("x2"), +el.getAttribute("y2"));
    return [p1, p2];
  }
  const d = el.getAttribute("d") || "";
  const pts = [];
  let cx = 0, cy = 0;
  const re = /([MLHVCZmlhvcz])([^MLHVCZmlhvcz]*)/g;
  let m;
  while ((m = re.exec(d))) {
    const cmd = m[1];
    const nums = m[2].trim().split(/[\s,]+/).filter(Boolean).map(Number);
    if (cmd === "M" || cmd === "L") {
      for (let i = 0; i + 1 < nums.length; i += 2) { cx = nums[i]; cy = nums[i + 1]; pts.push([cx, cy]); }
    } else if (cmd === "m" || cmd === "l") {
      for (let i = 0; i + 1 < nums.length; i += 2) { cx += nums[i]; cy += nums[i + 1]; pts.push([cx, cy]); }
    } else if (cmd === "H") { cx = nums[0]; pts.push([cx, cy]); }
    else if (cmd === "h") { cx += nums[0]; pts.push([cx, cy]); }
    else if (cmd === "V") { cy = nums[0]; pts.push([cx, cy]); }
    else if (cmd === "v") { cy += nums[0]; pts.push([cx, cy]); }
    // (our marks never use curves; C/S/Q would need sampling, skipped by design)
  }
  // path coordinates are local to the element's ancestor transforms
  return pts.map(([x, y]) => composePoint(el, x, y));
}

function* sampleSegments(pts, step = 2) {
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0] = pts[i - 1], [x1, y1] = pts[i];
    const len = Math.hypot(x1 - x0, y1 - y0);
    const n = Math.max(1, Math.ceil(len / step));
    for (let j = 0; j <= n; j++) yield [x0 + ((x1 - x0) * j) / n, y0 + ((y1 - y0) * j) / n];
  }
}

const shrink = (b, px) => ({ x0: b.x0 + px, x1: b.x1 - px, y0: b.y0 + px, y1: b.y1 - px });
const hit = (b, x, y) => x >= b.x0 && x <= b.x1 && y >= b.y0 && y <= b.y1;
const overlap = (a, b) => a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0;

/* ---------- main ---------- */
const issues = [];
let chartsSeen = 0;

for (const url of PAGES) {
  if (ONLY && url !== ONLY) continue;
  const file = path.join(DIST, url, "index.html");
  if (!fs.existsSync(file)) { console.error("MISSING BUILD:", url); continue; }
  const html = fs.readFileSync(file, "utf8");
  const dom = new JSDOM(html, { url: "https://indiaatlas.in" + url, pretendToBeVisual: true });
  const { window } = dom;
  if (VW) Object.defineProperty(window, "innerWidth", { value: VW, configurable: true });
  window.URL.createObjectURL = () => "blob:x";
  window.URL.revokeObjectURL = () => {};
  window.HTMLCanvasElement.prototype.getContext = () => null;
  for (const k of ["window", "document", "Node", "Element", "HTMLElement", "SVGElement", "XMLSerializer", "Image", "Blob", "CustomEvent", "Event", "getComputedStyle"]) {
    try { Object.defineProperty(globalThis, k, { value: window[k] ?? globalThis[k], configurable: true, writable: true }); } catch {}
  }
  globalThis.window = window;
  globalThis.document = window.document;
  const scripts = [...html.matchAll(/<script[^>]+src="([^"]+\.js)"/g)].map((m) => m[1]);
  try {
    // per-page query: a shared entry module runs once per page, not once per process (lb/profiles)
    for (const src of scripts) await import(pathToFileURL(path.join(DIST, src)).href + "?page=" + encodeURIComponent(url));
    await awaitChartJobs(window.document);
  } catch (e) {
    issues.push({ url, kind: "script-error", detail: e.message.slice(0, 160) });
    window.close();
    continue;
  }
  const doc = window.document;

  doc.querySelectorAll(".plotzone svg, .frontis svg").forEach((svg) => {
    chartsSeen++;
    const W = +svg.getAttribute("width") || 0;
    const block = svg.closest("[id]")?.id || "(anon)";
    const where = `${url} #${block}`;

    // plot frame rect from Plot's clipPath (for clip detection)
    let frame = null;
    const clipRect = svg.querySelector("clipPath rect");
    if (clipRect) {
      frame = {
        top: +clipRect.getAttribute("y"),
        bot: +clipRect.getAttribute("y") + +clipRect.getAttribute("height"),
      };
    }

    // strokes worth colliding with: series lines, rules, connectors
    const strokeLines = [];
    svg.querySelectorAll("g[aria-label] > path, g[aria-label] > line").forEach((el) => {
      const g = el.closest("g[aria-label]");
      const lbl = g.getAttribute("aria-label");
      if (SKIP_GROUP.test(lbl) || !COLLIDE_GROUPS.has(lbl)) return;
      const stroke = (el.getAttribute("stroke") || g.getAttribute("stroke") || "").toUpperCase();
      if (stroke === "NONE" || (el.getAttribute("display") || el.style.display) === "none") return;
      const pts = polylineOf(el);
      if (pts.length >= 2) strokeLines.push(pts);
    });

    // dots for centred-label detection
    const dots = [...svg.querySelectorAll("circle")].map((c) => composePoint(c, +c.getAttribute("cx"), +c.getAttribute("cy")));

    // text marks (annotations) — skip axis groups
    const texts = [...svg.querySelectorAll("text")].filter((t) => {
      const g = t.closest("g[aria-label]");
      if (g && SKIP_GROUP.test(g.getAttribute("aria-label"))) return false;
      return t.textContent.trim().length > 0;
    });
    const boxes = texts.map((t) => ({ t, box: textBox(t) })).filter((x) => x.box);

    for (const { t, box } of boxes) {
      const b = shrink(box, 3);
      const plated = !!t.closest("g.rowname");
      // collision with strokes; a short leader line that terminates within
      // 14px of its own label's anchor is the annotation's pointer, exempt.
      // A genuine strike has several sample hits or a deep one; a corner
      // graze (1–2 hits, all within 3px of the box edge) is halo-covered.
      const anchorPt = [box.ax, box.ay];
      outer: for (const pts of plated ? [] : strokeLines) {
        const ends = [pts[0], pts.at(-1)];
        const isLeader = pts.length <= 4 && ends.some(([ex, ey]) => Math.hypot(ex - anchorPt[0], ey - anchorPt[1]) < 14);
        if (isLeader) continue;
        let hits = 0, deep = 0;
        for (const [x, y] of sampleSegments(pts)) {
          if (hit(b, x, y)) {
            hits++;
            const depth = Math.min(x - b.x0, b.x1 - x, y - b.y0, b.y1 - y);
            if (depth >= 4) deep++;
          }
        }
        if (deep > 0 || hits >= 4) {
          const g = pts.map((p) => p.map((v) => v.toFixed(0)).join(",")).join(" ");
          issues.push({ url: where, kind: "collision", detail: `"${t.textContent.trim().slice(0, 44)}" box[${box.x0.toFixed(0)},${box.y0.toFixed(0)} → ${box.x1.toFixed(0)},${box.y1.toFixed(0)}] ${hits} hits (${deep} deep) stroke[${g.slice(0, 90)}]` });
          break outer;
        }
      }
      // bleed
      if (W && (box.x1 > W + 1 || box.x0 < -1)) {
        issues.push({ url: where, kind: "bleed", detail: `"${t.textContent.trim().slice(0, 44)}" runs to x≈${box.x1.toFixed(0)} (svg width ${W})` });
      }
      // centred on a dot
      const cxm = (box.x0 + box.x1) / 2, cym = (box.y0 + box.y1) / 2;
      for (const [dx, dy] of dots) {
        if (Math.hypot(cxm - dx, cym - dy) < 2.5) {
          issues.push({ url: where, kind: "centered-label", detail: `"${t.textContent.trim().slice(0, 44)}" sits on a dot` });
          break;
        }
      }
    }
    // text vs text
    for (let i = 0; i < boxes.length; i++) {
      for (let j = i + 1; j < boxes.length; j++) {
        if (overlap(shrink(boxes[i].box, 1), shrink(boxes[j].box, 1))) {
          issues.push({ url: where, kind: "text-overlap", detail: `"${boxes[i].t.textContent.trim().slice(0, 32)}" ∩ "${boxes[j].t.textContent.trim().slice(0, 32)}"` });
        }
      }
    }
    // empty-mark: a line/area group with no rendered geometry — the hydrated-
    // vs-raw data mixup class (a whole plate silently drawing nothing)
    svg.querySelectorAll('g[aria-label="line"], g[aria-label="area"]').forEach((g) => {
      const paths = [...g.querySelectorAll("path")].filter((p) => (p.getAttribute("d") || "").trim().length > 0);
      if (!paths.length) {
        issues.push({ url: where, kind: "empty-mark", detail: `empty ${g.getAttribute("aria-label")} mark — check the data mapping` });
      }
    });

    // possible clip: Plot clips marks VISUALLY via clipPath, so a series that
    // outgrows its y-domain keeps true vertices beyond the plot frame.
    // Scoped to full plates (width ≥ 500): small-multiple grids use bounded
    // shared axes by design — the five-figure rebound prints are clipped on
    // purpose and disclosed in prose.
    if (frame && W >= 500) {
      svg.querySelectorAll('g[aria-label="line"] path, g[aria-label="area"] path').forEach((p) => {
        for (const [x, y] of polylineOf(p)) {
          if (y < frame.top - 0.25 || y > frame.bot + 0.25) {
            issues.push({ url: where, kind: "clip", detail: `line vertex at y≈${y.toFixed(1)} outside frame ${frame.top.toFixed(1)}–${frame.bot.toFixed(1)} — data exceeds the y-domain` });
            break;
          }
        }
      });
    }
  });
  // All geometry has been inspected; no later page needs this DOM or its timers.
  window.close();
}

const byKind = {};
for (const i of issues) (byKind[i.kind] ??= []).push(i);
console.log(`chart lint${VW ? ` at ${VW}px` : ""}: ${chartsSeen} SVGs across ${ONLY ? 1 : PAGES.length} pages`);
if (!issues.length) {
  console.log("chart lint: clean — no collisions, overlaps, bleeds, clips or centred labels");
  process.exit(0);
}
for (const [kind, list] of Object.entries(byKind)) {
  console.log(`\n${kind} (${list.length})`);
  for (const i of list.slice(0, 60)) console.log(`  ${i.url} — ${i.detail}`);
  if (list.length > 25) console.log(`  … and ${list.length - 60} more`);
}
process.exit(1);
