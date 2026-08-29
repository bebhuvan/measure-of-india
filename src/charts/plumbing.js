// src/charts/plumbing.js — shared chart plumbing for every dossier plate.
// Extracted from site/dossiers/cpi.html (the reference implementation).
// Behaviour is normative; do not restyle. The only change from the reference
// is parameterisation: functions take explicit series/geo args instead of
// closing over page-level globals.
//
// Two hard-won chart rules, learned by eye-test (2026-08 audit):
//  1. Observable Plot IGNORES function-valued dx/dy/textAnchor on text marks —
//     it silently falls back to centred text over the dot. For per-datum
//     label sides, split into one Plot.text mark per side with constant
//     dx/textAnchor (see the stripLabelSide call sites).
//  2. Value labels must never be struck by rules or connectors: dot-strip
//     labels go on the side away from the reference rule (stripLabelSide),
//     dumbbell labels go outside the two dots, never between them.

import * as Plot from "@observablehq/plot";

export const MONO = "'IBM Plex Mono', monospace";

/* ---------- downloads ---------- */
/* A downloaded chart leaves the site; the site fonts must travel with it.
 * The card faces (Archivo for the title, Plex Mono for everything else) are
 * embedded as base64 woff2 @font-face rules on first use — without them the
 * SVG/PNG falls back to system fonts on the reader's machine. */
let _fontCssPromise = null;
function embeddedFontCss() {
  if (!_fontCssPromise) {
    _fontCssPromise = (async () => {
      const faces = [
        ["Archivo", "normal", "100 900", "archivo-normal"],
        ["IBM Plex Mono", "normal", "400", "plex-mono-400"],
        ["IBM Plex Mono", "normal", "500", "plex-mono-500"],
      ];
      const rules = await Promise.all(faces.map(async ([fam, style, weight, file]) => {
        const buf = await fetch("/fonts/" + file + ".woff2").then((r) => r.arrayBuffer());
        const bytes = new Uint8Array(buf);
        let bin = "";
        for (let i = 0; i < bytes.length; i += 32768) bin += String.fromCharCode(...bytes.subarray(i, i + 32768));
        return `@font-face{font-family:"${fam}";font-style:${style};font-weight:${weight};font-display:swap;src:url("data:font/woff2;base64,${btoa(bin)}") format("woff2");}`;
      }));
      return rules.join("");
    })();
  }
  return _fontCssPromise;
}
function withFonts(svgText, css) {
  return svgText.replace(/(<svg[^>]*>)/, `$1<style>${css}</style>`);
}

export function serializeSVG(svg) {
  let s = new XMLSerializer().serializeToString(svg);
  if (!/^<svg[^>]*\sxmlns=/.test(s)) s = s.replace(/<svg/, '<svg xmlns="http://www.w3.org/2000/svg"');
  const w = svg.getAttribute("width"), h = svg.getAttribute("height");
  return s.replace(/(<svg[^>]*>)/, `$1<rect width="${w}" height="${h}" fill="#FFFFFF"/>`);
}

/* A downloaded chart is a published artifact: it carries the plate title,
 * the unit/source line, and the site brand — never a bare plot. */
const escapeXml = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
export function composeCardSVG(svg, meta = {}) {
  const W = +svg.getAttribute("width"), H = +svg.getAttribute("height");
  const pad = 48;
  const headH = meta.title ? 64 : 0;
  // wrap the source line at "·" boundaries; reserve ~240px for the brand on the last line
  const footLines = [];
  if (meta.foot) {
    const limit = 130;
    let line = "";
    for (const seg of meta.foot.split(" · ")) {
      const candidate = line ? line + " · " + seg : seg;
      if (candidate.length > limit && line) { footLines.push(line); line = seg; }
      else line = candidate;
    }
    if (line) footLines.push(line);
  }
  const footH = 24 + footLines.length * 17;
  const totalW = W + pad * 2;
  const chartY = pad + headH;
  const totalH = chartY + H + footH + 16;
  const chart = serializeSVG(svg).replace(/<\?xml[^>]*\?>\s*/, "");
  const parts = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${totalW}" height="${totalH}" viewBox="0 0 ${totalW} ${totalH}">`,
    `<rect width="${totalW}" height="${totalH}" fill="#FFFFFF"/>`,
  ];
  if (meta.title) {
    parts.push(`<rect x="${pad}" y="${pad - 6}" width="9" height="9" fill="#BE3E26"/>`);
    parts.push(`<text x="${pad + 18}" y="${pad + 2}" font-family="Archivo, sans-serif" font-weight="680" font-size="21" letter-spacing="-0.4" fill="#1B1A17">${escapeXml(meta.title)}</text>`);
    if (meta.sub) parts.push(`<text x="${pad}" y="${pad + 28}" font-family="'IBM Plex Mono', monospace" font-size="11" letter-spacing="1" fill="#8A857A">${escapeXml(meta.sub.toUpperCase())}</text>`);
  }
  parts.push(`<g transform="translate(${pad},${chartY})">${chart}</g>`);
  const footY = chartY + H + 22;
  parts.push(`<line x1="${pad}" y1="${footY}" x2="${totalW - pad}" y2="${footY}" stroke="#E6E2D6"/>`);
  footLines.forEach((l, i) => {
    parts.push(`<text x="${pad}" y="${footY + 19 + i * 17}" font-family="'IBM Plex Mono', monospace" font-size="10.5" letter-spacing="0.8" fill="#8A857A">${escapeXml(l.toUpperCase())}</text>`);
  });
  const brandY = footY + 19 + (footLines.length - 1) * 17;
  parts.push(`<text x="${totalW - pad}" y="${brandY}" text-anchor="end" font-family="'IBM Plex Mono', monospace" font-size="10.5" letter-spacing="0.8" fill="#8A857A">INDIA ATLAS · THISINDIANLIFE.TODAY</text>`);
  parts.push(`</svg>`);
  return { svg: parts.join(""), width: totalW, height: totalH };
}

export function saveBlob(blob, filename) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
export function downloadSVG(svg, filename, meta) {
  embeddedFontCss().then((css) => {
    const out = meta ? withFonts(composeCardSVG(svg, meta).svg, css) : withFonts(serializeSVG(svg), css);
    saveBlob(new Blob([out], { type: "image/svg+xml" }), filename + ".svg");
  });
}
export function downloadPNG(svg, filename, meta) {
  embeddedFontCss().then((css) => {
    const card = meta ? composeCardSVG(svg, meta) : { svg: serializeSVG(svg), width: +svg.getAttribute("width"), height: +svg.getAttribute("height") };
    const url = URL.createObjectURL(new Blob([withFonts(card.svg, css)], { type: "image/svg+xml" }));
    const img = new Image();
    img.onload = () => {
      const scale = 3, canvas = document.createElement("canvas");
      canvas.width = card.width * scale;
      canvas.height = card.height * scale;
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "#FFFFFF";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      canvas.toBlob((b) => saveBlob(b, filename + ".png"), "image/png");
    };
    img.onerror = () => URL.revokeObjectURL(url);
    img.src = url;
  });
}
export function downloadCSV(seriesList, filename, fmtDate) {
  // Join by date key, never by array index: series on one plate may start at
  // different dates (base-year handoffs), and an index join silently pairs a
  // date with another month's value. Rows are the union of all dates, sorted;
  // a series contributes nothing where it has no datum.
  const name = (s) => s.name ?? s.label ?? "series";
  const key = (d) => (d instanceof Date ? d.toISOString().slice(0, 10) : String(d));
  const dateSet = new Map(); // key -> Date (first series to have it wins)
  const columns = seriesList.map((s) => {
    const m = new Map();
    for (const d of s.data) {
      const k = key(d.date);
      if (!m.has(k)) m.set(k, d.value);
      if (!dateSet.has(k)) dateSet.set(k, d.date);
    }
    return m;
  });
  const keys = [...dateSet.keys()].sort();
  const esc = (v) => {
    const t = v == null ? "" : String(v);
    return /[",\n]/.test(t) ? '"' + t.replace(/"/g, '""') + '"' : t;
  };
  const lines = [ ["date", ...seriesList.map(name)].map(esc).join(",") ];
  for (const k of keys) {
    lines.push([esc(fmtDate ? fmtDate(dateSet.get(k)) : k), ...columns.map((m) => esc(m.get(k)))].join(","));
  }
  saveBlob(new Blob([lines.join("\n")], { type: "text/csv" }), filename + ".csv");
}
export function wireTools(blockEl, plot, seriesList, filename, fmtDate) {
  const meta = {
    title: blockEl.querySelector(".plate-head h3")?.textContent.trim(),
    sub: blockEl.querySelector(".plate-head .sub")?.textContent.trim(),
    foot: blockEl.querySelector(".plotfoot .src")?.textContent.trim().replace(/\s+/g, " "),
  };
  blockEl.querySelectorAll("[data-dl]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const kind = btn.dataset.dl;
      if (kind === "svg") downloadSVG(plot, filename, meta);
      if (kind === "png") downloadPNG(plot, filename, meta);
      if (kind === "csv") downloadCSV(seriesList, filename, fmtDate);
    });
  });
}

/* ---------- accessibility ---------- */
export function a11y(plot, title, desc) {
  plot.setAttribute("role", "img");
  plot.setAttribute("aria-label", title + ". " + desc);
  const t = document.createElementNS("http://www.w3.org/2000/svg", "title");
  t.textContent = title;
  plot.insertBefore(t, plot.firstChild);
}

/* ---------- crosshair ----------
 * The pixel mapping comes from the plot's OWN scales (plot.scale("x"/"y")) —
 * geo is kept only as a legacy fallback. The old geo contract — a hand-mirrored
 * copy of the plot's width/margins/domain — was a second source of truth and a
 * drift bug class. Null values are skipped: a gap shows "—", never NaN. */
export function addCrosshair(container, plot, seriesList, geo, fmtDate, fmtV = (v) => (v == null ? "—" : v.toFixed(2) + "%")) {
  const ns = "http://www.w3.org/2000/svg";
  const tip = container.querySelector(".cb-tip");
  // empty series or a plate missing its tooltip div: crosshair off, not a crash
  if (!seriesList[0]?.data.length || !tip) return;
  const xs = plot.scale?.("x"), ys = plot.scale?.("y");
  const useScales = xs && ys && (xs.type === "time" || xs.type === "utc") && ys.type === "linear" && typeof xs.invert === "function";
  let xPix, yPix, invX, ruleTop, ruleBot, W, xLo, xHi;
  if (useScales) {
    W = +plot.getAttribute("width");
    xPix = (d) => xs.apply(d);
    yPix = (v) => ys.apply(v);
    invX = (px) => xs.invert(px).getTime();
    ruleTop = Math.min(...ys.range);
    ruleBot = Math.max(...ys.range);
    xLo = Math.min(...xs.range); xHi = Math.max(...xs.range);
  } else {
    const { W: gW, H: gH, ml, mr, mt, mb, d0, d1 } = geo;
    const t0 = seriesList[0].data[0].date.getTime(), t1 = seriesList[0].data.at(-1).date.getTime();
    xPix = (d) => ml + ((d.getTime() - t0) / (t1 - t0)) * (gW - ml - mr);
    yPix = (v) => mt + (1 - (v - d0) / (d1 - d0)) * (gH - mt - mb);
    invX = (px) => t0 + ((px - ml) / (gW - ml - mr)) * (t1 - t0);
    ruleTop = mt;
    ruleBot = gH - mb;
    W = gW; xLo = ml; xHi = gW - mr;
  }
  const rule = document.createElementNS(ns, "line");
  rule.setAttribute("stroke", "#1B1A17");
  rule.setAttribute("stroke-width", "1");
  rule.setAttribute("y1", ruleTop);
  rule.setAttribute("y2", ruleBot);
  rule.style.display = "none";
  plot.appendChild(rule);
  const dots = seriesList.map((s) => {
    const c = document.createElementNS(ns, "circle");
    c.setAttribute("r", "3.5");
    c.setAttribute("fill", s.color);
    c.setAttribute("stroke", "#FFFFFF");
    c.setAttribute("stroke-width", "1.5");
    c.style.display = "none";
    plot.appendChild(c);
    return c;
  });
  plot.addEventListener("pointermove", (e) => {
    const rect = plot.getBoundingClientRect();
    const px = (e.clientX - rect.left) * (W / rect.width);
    if (px < xLo || px > xHi) return;
    const target = invX(px);
    let i = 0, best = Infinity;
    seriesList[0].data.forEach((d, j) => {
      const diff = Math.abs(d.date.getTime() - target);
      if (diff < best) { best = diff; i = j; }
    });
    const d = seriesList[0].data[i].date, x = xPix(d);
    rule.setAttribute("x1", x);
    rule.setAttribute("x2", x);
    rule.style.display = "";
    seriesList.forEach((s, k) => {
      const v = s.data[i]?.value; // a series may not cover this date
      dots[k].setAttribute("cx", x);
      if (v == null) { dots[k].style.display = "none"; return; }
      dots[k].setAttribute("cy", yPix(v));
      dots[k].style.display = "";
    });
    tip.innerHTML = `<div class="d">${fmtDate(d)}</div>` +
      seriesList.map((s) => `<div class="r"><span class="sw2" style="background:${s.color}"></span><span class="n">${s.label}</span><span class="v">${fmtV(s.data[i]?.value)}</span></div>`).join("");
    tip.style.display = "block";
    const flip = x > W * 0.72;
    tip.style.left = (flip ? x - 16 - tip.offsetWidth : x + 16) + "px";
    const head = seriesList[0].data[i].value;
    tip.style.top = Math.max(10, (head == null ? ruleTop : yPix(head)) - 40) + "px";
  });
  plot.addEventListener("pointerleave", () => {
    rule.style.display = "none";
    dots.forEach((c) => (c.style.display = "none"));
    tip.style.display = "none";
  });
}

/* ---------- legend hover-isolation ----------
 * Works only because each series color is unique on a chart. */
export function wireLegend(blockEl, plot, keys, S) {
  blockEl.querySelectorAll(".chip").forEach((chip) => {
    chip.addEventListener("mouseenter", () => {
      keys.forEach((k) => {
        if (k === chip.dataset.key) return;
        const c = S[k].color;
        plot.querySelectorAll(`[stroke="${c}"],[fill="${c}"]`).forEach((el) => { el.style.opacity = 0.12; });
      });
    });
    chip.addEventListener("mouseleave", () => {
      plot.querySelectorAll("[style]").forEach((el) => { el.style.opacity = ""; });
    });
  });
}

/* ---------- annotation helpers ---------- */
// All three skip unpublished points (null); a trailing null must never be
// reported as a peak/trough/end-label.
/* Dot-strip value labels: a label drawn right of a dot is struck through by
 * a vertical rule (all-India average, headline, zero) sitting within its
 * reach. Chooses a spot: right of the dot, left of it, or — when rules
 * hem the dot in on both sides — centred above it. Returns {anchor, dx, dy}
 * for constant Plot.text options (never functions; Plot ignores those). */
export function stripLabelSpot(geo, dom0, dom1, v, ruleVs, labelPx = 52) {
  const pxU = (geo.W - geo.ml - geo.mr) / (dom1 - dom0);
  const units = labelPx / pxU;
  const rules = (Array.isArray(ruleVs) ? ruleVs : [ruleVs]).filter((r) => r != null);
  const rightHit = rules.some((r) => r > v && r - v < units);
  const leftHit = rules.some((r) => r < v && v - r < units);
  if (!rightHit) return { anchor: "start", dx: 13, dy: 0.5 };
  if (!leftHit) return { anchor: "end", dx: -13, dy: 0.5 };
  return { anchor: "middle", dx: 0, dy: -11 };
}
/* Back-compat: ±1 side for callers that only handle two marks. */
export function stripLabelSide(geo, dom0, dom1, v, ruleV, labelPx = 64) {
  const s = stripLabelSpot(geo, dom0, dom1, v, ruleV, labelPx);
  return s.anchor === "end" ? -1 : 1;
}

/* ---------- collision-aware label placement ----------
 * Annotations are placed in pixel space against sampled obstacle points
 * (series lines, rules, connectors) — the same geometry lint-charts.mjs
 * verifies at the gate. Usage:
 *   const placer = makePlacer(geo, dates);
 *   placer.addSeries(S.food.data); placer.addRuleY(4); placer.addRuleX(covid);
 *   const spot = placer.place(text, fontSize, [
 *     { x: pk.date, y: pk.value, anchor: "middle", dx: 0, dy: -30 },
 *     { x: pk.date, y: pk.value, anchor: "start", dx: 22, dy: -22 },
 *   ]); // → {x, y, anchor} in DATA units for Plot.text
 * Candidates are tried in order; the last is used regardless (add a safe one).
 */
export function makePlacer(geo, dates) {
  const { W, H, ml, mr, mt, mb, d0, d1 } = geo;
  const t0 = +dates[0], t1 = +dates.at(-1);
  const pxX = (d) => ml + ((+d - t0) / (t1 - t0)) * (W - ml - mr);
  const pxY = (v) => mt + (1 - (v - d0) / (d1 - d0)) * (H - mt - mb);
  const sx = (px) => px / ((W - ml - mr) / (t1 - t0));   // px → ms
  const sy = (px) => px / ((H - mt - mb) / (d1 - d0));   // px → value
  const obstacles = [];
  const placer = {
    pxX, pxY, sx, sy,
    addSeries(data) {
      // sample segments at ~3px: a line can clip a label even when no
      // vertex falls inside the box (lint-charts.mjs samples the same way)
      let prev = null;
      for (const d of data) {
        if (d.value == null) { prev = null; continue; }
        const p = [pxX(d.date), pxY(d.value)];
        if (prev) {
          const n = Math.max(1, Math.ceil(Math.hypot(p[0] - prev[0], p[1] - prev[1]) / 3));
          for (let i = 1; i <= n; i++) obstacles.push([prev[0] + ((p[0] - prev[0]) * i) / n, prev[1] + ((p[1] - prev[1]) * i) / n]);
        } else obstacles.push(p);
        prev = p;
      }
      return placer;
    },
    addRuleY(v) { for (let x = ml; x <= W - mr; x += 2) obstacles.push([x, pxY(v)]); return placer; },
    addRuleX(d) { for (let y = mt; y <= H - mb; y += 2) obstacles.push([pxX(d), y]); return placer; },
    addSegment(a, b) {
      const n = Math.max(2, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 2));
      for (let i = 0; i <= n; i++) obstacles.push([a[0] + ((b[0] - a[0]) * i) / n, a[1] + ((b[1] - a[1]) * i) / n]);
      return placer;
    },
    // a placed label becomes an obstacle for the next one
    addObstacleBox(b) {
      for (let x = b.x0; x <= b.x1; x += 2) { obstacles.push([x, b.y0], [x, b.y1]); }
      for (let y = b.y0; y <= b.y1; y += 2) { obstacles.push([b.x0, y], [b.x1, y]); }
      return placer;
    },
    // candidate → pixel box. Matches Plot's text metrics exactly (and
    // lint-charts.mjs): Plot renders text with y="0.32em", so the baseline
    // sits 0.32em below the anchor; glyphs span cy−0.50em … cy+0.54em.
    box(c, text, fontSize) {
      const cx = pxX(c.x) + (c.dx ?? 0), cy = pxY(c.y) + (c.dy ?? 0);
      const w = text.length * fontSize * 0.6;
      const x0 = c.anchor === "end" ? cx - w : c.anchor === "middle" ? cx - w / 2 : cx;
      return { x0, x1: x0 + w, y0: cy - 0.50 * fontSize, y1: cy + 0.54 * fontSize };
    },
    fits(b, shrinkPx = 2) {
      const x0 = b.x0 + shrinkPx, x1 = b.x1 - shrinkPx, y0 = b.y0 + shrinkPx, y1 = b.y1 - shrinkPx;
      if (x1 > W + 1 || x0 < -1) return false;                    // never bleed
      if (y0 < 4 || y1 > H - 4) return false;                     // stay on canvas
      for (const [ox, oy] of obstacles) {
        if (ox >= x0 && ox <= x1 && oy >= y0 && oy <= y1) return false;
      }
      return true;
    },
    place(text, fontSize, candidates, shrinkPx = 3) {
      for (const c of candidates) {
        if (placer.fits(placer.box(c, text, fontSize), shrinkPx)) return c;
      }
      return candidates.at(-1);
    },
  };
  return placer;
}

/* Place one annotation against the placer's obstacles and get everything
 * Plot.text plus its leader line needs, in DATA coordinates.
 *   const { spot, textX, textY, leader } = annotationSpot(placer, pk,
 *     "7.3% · Dec 2019", 13, [
 *       { x: pk.date, y: pk.value, anchor: "middle", dx: 0, dy: 30 },
 *       { x: pk.date, y: pk.value, anchor: "start", dx: 22, dy: 18 },
 *     ]);
 * candidates' dx/dy are px, dy positive = UP the screen (the house habit).
 * leader: [{x,y}…] in data coords, from the point to just short of the text. */
export function annotationSpot(placer, point, text, fontSize, candidates) {
  const px0 = point.x ?? point.date, py0 = point.y ?? point.value;   // accept {x,y} or {date,value}
  const tested = candidates.map((c) => ({ ...c, dy: -(c.dy ?? 0) }));
  const raw = placer.place(text, fontSize, tested);
  const spot = { ...raw, dy: -(raw.dy ?? 0) };
  const box = placer.box(raw, text, fontSize);   // pixel box, for addObstacleBox
  const textX = new Date(+spot.x + placer.sx(spot.dx ?? 0));
  const textY = spot.y + placer.sy(spot.dy ?? 0);
  const dirSign = spot.dy >= 0 ? 1 : -1;
  const nearX = spot.anchor === "start" ? -8 : spot.anchor === "end" ? 8 : 0;
  const leader = spot.anchor === "middle"
    ? [{ x: px0, y: py0 + placer.sy(dirSign * 8) },
       { x: px0, y: textY - placer.sy(dirSign * (0.82 * fontSize + 4)) }]
    : [{ x: px0, y: py0 + placer.sy(dirSign * 8) },
       { x: px0, y: textY },
       { x: new Date(+textX + placer.sx(nearX)), y: textY }];
  return { spot, box, textX, textY, leader };
}

export function peakOf(s) {
  let p = null;
  for (const d of s.data) if (d.value != null && (!p || d.value > p.value)) p = d;
  return p ?? s.data[0];
}
export function troughOf(s) {
  let p = null;
  for (const d of s.data) if (d.value != null && (!p || d.value < p.value)) p = d;
  return p ?? s.data[0];
}
export function peakBetween(s, a, b) {
  // a,b may be years (numbers) or Dates
  const lo = a instanceof Date ? a : new Date(Date.UTC(a, 0, 1));
  const hi = b instanceof Date ? b : new Date(Date.UTC(b, 11, 31));
  let p = null;
  for (const d of s.data) if (d.value != null && d.date >= lo && d.date <= hi && (!p || d.value > p.value)) p = d;
  return p;
}
export function dodgeEndLabels(seriesList, gap) {
  // end-labels anchor on each series' last PUBLISHED point, not the last axis cell
  const last = (s) => {
    for (let i = s.data.length - 1; i >= 0; i--) if (s.data[i].value != null) return s.data[i];
    return null;
  };
  const pts = seriesList
    .map((s) => ({ key: s.label, e: last(s), s }))
    .filter((p) => p.e)
    .map((p) => ({ key: p.key, value: p.e.value, y: p.e.value, s: p.s }));
  pts.sort((a, b) => b.y - a.y);
  for (let i = 1; i < pts.length; i++) if (pts[i - 1].y - pts[i].y < gap) pts[i].y = pts[i - 1].y - gap;
  return pts;
}

/* ---------- sparkline ---------- */
export function spark(id, s) {
  const vs = s.data.map((d) => d.value).filter((v) => v != null);
  if (!vs.length || !document.getElementById(id)) return; // nothing published: leave the cell empty
  let end = null;
  for (let i = s.data.length - 1; i >= 0; i--) if (s.data[i].value != null) { end = s.data[i]; break; }
  const plot = Plot.plot({
    width: 190, height: 44,
    marginLeft: 0, marginRight: 0, marginTop: 4, marginBottom: 4,
    style: { background: "transparent" },
    x: { axis: null },
    y: { axis: null, domain: [Math.min(...vs, 0), Math.max(...vs)] },
    marks: [
      Plot.ruleY([0], { stroke: "#E6E2D6" }),
      Plot.lineY(s.data, { x: "date", y: "value", stroke: s.color, strokeWidth: 1.5, strokeLinejoin: "round" }),
      Plot.dot(end ? [end] : [], { x: "date", y: "value", fill: s.color, r: 2.5, stroke: "#FFFFFF", strokeWidth: 1 }),
    ],
  });
  plot.setAttribute("aria-hidden", "true");
  document.getElementById(id).append(plot);
}

/* ---------- baked-bundle hydration ----------
 * data/series/<slug>.json stores dates as ISO strings and per-series data as
 * parallel value arrays; pages need [{date: Date, value}] per series. */
export function hydrate(bundle) {
  const dates = bundle.dates.map((d) => new Date(d + "T00:00:00Z"));
  const S = {};
  for (const [k, s] of Object.entries(bundle.series)) {
    S[k] = {
      name: s.name, label: s.label, color: s.color,
      data: s.data.map((v, i) => ({ date: dates[i], value: v })),
    };
  }
  return S;
}

// shared number renderers (docs/CONTRACT-render.md): clients and qc.mjs both
// format through src/charts/format.js so a formatter change cannot desync a
// plate from its gate.
export * as fmt from "./format.js";
