// src/charts/plumbing.js — shared chart plumbing for every dossier plate.
// Extracted from site/dossiers/cpi.html (the reference implementation).
// Behaviour is normative. Visual language: v2 (2026-10 redesign, see docs/DESIGN.md).
// The only change from the reference
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
import FONTS from "../styles/fonts.generated.js";

// Chart text is Golos Text (proportional, tabular figures). The export keeps its old name,
// MONO, so the 15 client files that import it need no change; SANS is the honest alias.
export const SANS = "'Golos Text', system-ui, sans-serif";
export const MONO = SANS;

// Draw the complete plate list while letting input/paint run between batches. The job list
// is document-scoped so independent modules never overwrite each other's readiness.
// A single expensive chart can exceed the budget; browser tracing must measure that too.
export function queueCharts(items, draw, { budget = 45, doc = document } = {}) {
  const view = doc.defaultView;
  let resolve, reject, cursor = 0, finished = false;
  const job = { total: items.length, completed: 0, errors: [], promise: new Promise((a,b) => { resolve=a; reject=b; }) };
  (doc.__atlasChartJobs ??= []).push(job);
  // Errors remain visible and reject readiness, while letting unaffected plates finish.
  job.promise.catch(() => {});
  const next = () => {
    const item = items[cursor++];
    try { draw(item); } catch (e) {
      job.errors.push(String(e.message ?? e));
      const zone = doc.getElementById('plot-' + item.id);
      if (zone) { const message=doc.createElement('p');message.setAttribute('role','alert');message.textContent='This chart could not load.';zone.append(message); }
    }
    job.completed++;
  };
  const complete = () => {
    if (finished) return;
    finished=true; view?.removeEventListener('beforeprint', drain);
    if (job.errors.length) reject(new Error(`Chart rendering failed: ${job.errors.join('; ')}`));
    else resolve();
  };
  const drain = () => { while(cursor<items.length)next();complete(); };
  view?.addEventListener('beforeprint', drain);
  const run = async () => {
    while(cursor<items.length) {
      const start=view?.performance.now() ?? performance.now();
      do { next(); } while(cursor<items.length&&(view?.performance.now() ?? performance.now())-start<budget);
      if(cursor<items.length) {
        if(view?.scheduler?.yield) await view.scheduler.yield();
        else await new Promise(r => (view?.setTimeout.bind(view) ?? setTimeout)(r,0));
      }
    }
    complete();
  };
  run().catch(reject);
  return job;
}

// Small multiples draw at the actual CSS grid track width, preserving font size.
// Before layout (including jsdom), retain the authored width rather than inventing one.
export function panelPlotWidth(grid, authoredWidth) {
  const view = grid?.ownerDocument?.defaultView;
  if (!view?.getComputedStyle) return authoredWidth;
  const tracks = view.getComputedStyle(grid).gridTemplateColumns.match(/\d+(?:\.\d+)?px/g);
  const widths = tracks?.map(parseFloat).filter(v => v > 0);
  return widths?.length ? Math.min(authoredWidth, Math.min(...widths)) : authoredWidth;
}

/* ---------- downloads ---------- */
/* A downloaded chart leaves the site; the site fonts must travel with it.
 * The card faces (Source Serif 4 for the title, Golos Text for everything else) are
 * embedded as base64 woff2 @font-face rules on first use — without them the
 * SVG/PNG falls back to system fonts on the reader's machine. */
let _fontCssPromise = null;
function embeddedFontCss() {
  if (!_fontCssPromise) {
    _fontCssPromise = (async () => {
      // the site's primary and extra files (scripts/fonts-build.mjs): every character the pages use
      const faces = ["serif", "sans"].flatMap((id) => ["primary", "extra"].filter((p) => FONTS.faces[id].files[p])
        .map((p) => [FONTS.faces[id].family, FONTS.faces[id].style, FONTS.faces[id].weight, FONTS.faces[id].files[p]]));
      const rules = await Promise.all(faces.map(async ([fam, style, weight, file]) => {
        const buf = await fetch("/fonts/" + file).then((r) => r.arrayBuffer());
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

/* The page lifts chart text and hairlines with CSS (atlas.css, DESIGN §0.3) and draws a white
 * halo behind every label. A download leaves the page's CSS behind, so the computed paint is
 * written onto a copy of the chart first: what the reader saw is what the file holds. Where
 * there is no computed style (jsdom, the qc gate) the chart is serialised as authored. */
const PAINT = ["fill", "stroke"];
function inlinePaint(svg) {
  const view = svg.ownerDocument?.defaultView;
  if (!view?.getComputedStyle || !svg.cloneNode) return svg;
  const copy = svg.cloneNode(true);
  const src = [svg, ...svg.querySelectorAll("*")], dst = [copy, ...copy.querySelectorAll("*")];
  const rootColor = view.getComputedStyle(svg).color;
  if (rootColor) copy.style.color = rootColor;
  src.forEach((el, i) => {
    const cs = view.getComputedStyle(el), out = dst[i];
    for (const k of PAINT) if (el.hasAttribute(k) && cs[k] && cs[k] !== "none") out.setAttribute(k, cs[k]);
    if (el.tagName.toLowerCase() === "text" && cs.paintOrder && /stroke/.test(cs.paintOrder) && cs.stroke && cs.stroke !== "none" && !el.closest?.(".inbar")) {
      out.setAttribute("fill", cs.fill);
      out.setAttribute("stroke", cs.stroke);
      out.setAttribute("stroke-width", cs.strokeWidth || "4px");
      out.setAttribute("stroke-linejoin", "round");
      out.setAttribute("paint-order", "stroke");
    }
  });
  return copy;
}

export function serializeSVG(svg) {
  let s = new XMLSerializer().serializeToString(inlinePaint(svg));
  if (!/^<svg[^>]*\sxmlns=/.test(s)) s = s.replace(/<svg/, '<svg xmlns="http://www.w3.org/2000/svg"');
  const w = svg.getAttribute("width"), h = svg.getAttribute("height");
  return s.replace(/(<svg[^>]*>)/, `$1<rect width="${w}" height="${h}" fill="#FFFFFF"/>`);
}

/* A downloaded chart is a published artifact: it carries the plate title,
 * the unit/source line, and the site brand — never a bare plot. */
const escapeXml = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
export function composeCardSVG(svg, meta = {}) {
  // A finished graphic, ready to post, set like the chart card on the page (DESIGN §0.4): the
  // finding as the title with the readout figure on the right, the subtitle, the key, the
  // chart, a hairline, the source, and the site's name. Text is wrapped by an advance-width
  // estimate so it works the same in the browser and in jsdom (the qc gate).
  const W = +svg.getAttribute("width"), H = +svg.getAttribute("height");
  const pad = 56, inner = W, totalW = W + pad * 2;
  const wrap = (text, size, k, maxW) => {
    const words = String(text || "").replace(/\s+/g, " ").trim().split(" "), out = [];
    let line = "";
    for (const w of words) {
      const t = line ? line + " " + w : w;
      if (t.length * size * k > maxW && line) { out.push(line); line = w; } else line = t;
    }
    if (line) out.push(line);
    return out;
  };
  const fig = svg.closest?.("figure");
  // the readout: the one figure the finding is about, as the page shows it beside the title
  const val = meta.val ?? fig?.querySelector(".plate-val .v")?.textContent.replace(/\s+/g, " ").trim();
  const valCap = meta.valCap ?? fig?.querySelector(".plate-val .c")?.textContent.replace(/\s+/g, " ").trim();
  // set by length, as on the page: a figure large, a long figure smaller, words as a serif line
  const vSize = !val ? 0 : (!/[0-9]/.test(val) || val.length > 13) ? 24 : val.length > 8 ? 32 : 40;
  const valW = val ? Math.max(val.length * vSize * 0.5, (valCap || "").length * 13 * 0.52) + 48 : 0;
  const stacked = inner < 640;
  const titleL = meta.title ? wrap(meta.title, 30, 0.47, Math.min(stacked ? inner : inner - 40 - valW, 980)) : [];
  const subL = meta.sub ? wrap(meta.sub, 15, 0.5, Math.min(stacked ? inner : inner - 60 - valW, 860)) : [];
  const footL = meta.foot ? wrap(meta.foot, 12.5, 0.52, Math.min(stacked ? inner : inner - 280, 820)) : [];
  let y = pad + 24;
  const parts = [];
  if (val && !stacked) {
    parts.push(`<text x="${totalW - pad}" y="${pad + 30}" text-anchor="end" font-family="'Source Serif 4', serif" font-weight="${vSize === 24 ? 400 : 300}" font-size="${vSize}" letter-spacing="${vSize === 24 ? -0.1 : -0.6}" fill="#161A22">${escapeXml(val)}</text>`);
    if (valCap) parts.push(`<text x="${totalW - pad}" y="${pad + 54}" text-anchor="end" font-family="'Golos Text', sans-serif" font-size="13" fill="#6B7180">${escapeXml(valCap)}</text>`);
  }
  titleL.forEach((l, i) => parts.push(`<text x="${pad}" y="${y + i * 38}" font-family="'Source Serif 4', serif" font-weight="500" font-size="30" letter-spacing="-0.3" fill="#161A22">${escapeXml(l)}</text>`));
  y += titleL.length ? (titleL.length - 1) * 38 + 32 : 0;
  subL.forEach((l, i) => parts.push(`<text x="${pad}" y="${y + i * 22}" font-family="'Golos Text', sans-serif" font-size="15" fill="#4A5160">${escapeXml(l)}</text>`));
  y += subL.length ? (subL.length - 1) * 22 + 30 : 0;
  if (val && stacked) {
    y += 12;
    parts.push(`<text x="${pad}" y="${y + vSize}" font-family="'Source Serif 4', serif" font-size="${vSize}" fill="#161A22">${escapeXml(val)}</text>`);
    y += vSize + 20;
    if (valCap) {
      for (const line of wrap(valCap, 13, 0.52, inner)) {
        parts.push(`<text x="${pad}" y="${y}" font-family="'Golos Text', sans-serif" font-size="13" fill="#6B7180">${escapeXml(line)}</text>`);
        y += 19;
      }
    }
    y += 14;
  }
  if (val && y < pad + 74) y = pad + 74;   // the readout's caption must clear the key
  // the colour key: taken from the chart's own legend on the page, so a shared image is never
  // a set of unexplained colours. Swatches are read from each chip's <i>: a thin chip is a line
  // series and is drawn as a short line, a square chip as a square, a ringed chip as a ring.
  const key = meta.key ?? [...(fig?.querySelectorAll(".legend .chip") ?? [])].map((c) => {
    const i = c.querySelector("i"); const st = i?.getAttribute("style") || "";
    const col = (st.match(/background(?:-color)?:\s*([^;]+)/) || [])[1]?.trim() || "#878D99";
    const ring = /border/.test(st) && /#fff/i.test(col);
    const dash = i?.classList?.contains("dash");
    const swatchCol = ring ? ((st.match(/border:[^;]*?(#[0-9A-Fa-f]{3,6})/) || [])[1] || "#878D99") : dash ? "#A3A9B4" : col;
    const hgt = parseFloat((st.match(/height:\s*([\d.]+)px/) || [])[1] ?? "2");
    return { label: c.textContent.replace(/\s+/g, " ").trim(), color: swatchCol, ring, line: !ring && hgt <= 4, dash };
  }).filter((k) => k.label);
  if (key.length) {
    let kx = pad; const ky = y + 4;
    for (const k of key) {
      const lw = k.label.length * 13 * 0.52;
      if (kx + 24 + lw > totalW - pad && kx > pad) { kx = pad; y += 22; }
      const yy = y + 4;
      parts.push(k.ring ? `<circle cx="${kx + 6}" cy="${yy - 4.5}" r="4" fill="#fff" stroke="${escapeXml(k.color)}" stroke-width="1.5"/>`
        : k.line ? `<line x1="${kx}" x2="${kx + 18}" y1="${yy - 4.5}" y2="${yy - 4.5}" stroke="${escapeXml(k.color)}" stroke-width="2.5"${k.dash ? ' stroke-dasharray="3 2"' : ""}/>`
        : `<rect x="${kx + 2}" y="${yy - 9.5}" width="10" height="10" fill="${escapeXml(k.color)}"/>`);
      parts.push(`<text x="${kx + 26}" y="${yy}" font-family="'Golos Text', sans-serif" font-size="13" fill="#4A5160">${escapeXml(k.label)}</text>`);
      kx += 26 + lw + 26;
    }
    void ky;
    y += 30;
  }
  const chartY = y;
  const chart = serializeSVG(svg).replace(/<\?xml[^>]*\?>\s*/, "");
  parts.push(`<g transform="translate(${pad},${chartY})">${chart}</g>`);
  const footY = chartY + H + 28;
  parts.push(`<line x1="${pad}" y1="${footY}" x2="${totalW - pad}" y2="${footY}" stroke="#DFE2E8"/>`);
  footL.forEach((l, i) => parts.push(`<text x="${pad}" y="${footY + 26 + i * 19}" font-family="'Golos Text', sans-serif" font-size="12.5" fill="#6B7180">${escapeXml(l)}</text>`));
  const brandY = stacked ? footY + 26 + footL.length * 19 + 24 : footY + 27;
  parts.push(`<text x="${totalW - pad}" y="${brandY}" text-anchor="end" font-family="'Source Serif 4', serif" font-weight="600" font-size="18" letter-spacing="-0.2" fill="#161A22">India Atlas</text>`);
  parts.push(`<text x="${totalW - pad}" y="${brandY + 19}" text-anchor="end" font-family="'Golos Text', sans-serif" font-size="12.5" fill="#6B7180">atlas.thisindianlife.today</text>`);
  const totalH = Math.ceil(footY + Math.max(26 + footL.length * 19, brandY - footY + 35) + pad - 16);
  const out = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${totalW}" height="${totalH}" viewBox="0 0 ${totalW} ${totalH}">`,
    `<rect width="${totalW}" height="${totalH}" fill="#FFFFFF"/>`,
    ...parts, `</svg>`,
  ];
  return { svg: out.join(""), width: totalW, height: totalH };
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
  rule.setAttribute("stroke", "#161A22");
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

/* ---------- seams: two rulers on one chart ----------
 * A base change gives two rulers, never one series (AGENTS.md hard rule 1; the seams are
 * registered in data/sources.yml `seams:`). Every plate that draws more than one ruler
 * draws it through seamMarks, in one of three treatments and nothing else
 * (docs/INVENTORY-data-paths.md "Base years", proposal point 2):
 *   "side"    rulers side by side on one time axis; a changeover marker where the new
 *             ruler starts. Lines are never joined across the marker.
 *   "overlap" growth computed inside each base from that base's own levels, both lines
 *             drawn through the months both describe; the marker where the old ruler ends.
 *   "agency"  a linked line, only where the agency publishes the link (NSO back series,
 *             a published linking factor). Its reconstructed stretch is a solid pale tint
 *             of the line's colour (DESIGN.md: never transparency), the measured stretch
 *             solid; the marker sits at the handoff and its text names the agency.
 * Rulers are given oldest first; the last one is drawn on top. Each ruler:
 *   { data: [{date, value}], color, width = 1.75 (the last ruler 2), label?,
 *     reconstructedUntil?: Date (agency only: points before it are the agency's back-cast) }
 * marker: { text, at?: Date, y: value at which the text sits, anchor = "end", dx = -8,
 *           solid?: bool (a solid hairline instead of the dashed one), fontSize = 12 }
 *         or false for no marker (a plate whose rulers do not meet).
 * Returns Plot marks; spread them into the plate's marks between grid and end labels.
 * Throws on a misuse that would read as a splice: one ruler, an "agency" seam whose marker
 * text names no agency, or an "agency" ruler without its reconstructedUntil. */
export const SEAM_RULE = "#CDD1D8";
export function tint(hex, k = 0.55) {
  const n = parseInt(hex.slice(1), 16), c = [n >> 16, (n >> 8) & 255, n & 255].map((v) => Math.round(v + (255 - v) * k));
  return "#" + c.map((v) => v.toString(16).padStart(2, "0")).join("").toUpperCase();
}
const lastPublished = (data) => { for (let i = data.length - 1; i >= 0; i--) if (data[i].value != null) return data[i]; return null; };
const firstPublished = (data) => data.find((d) => d.value != null) ?? null;
export function seamMarks(treatment, rulers, marker = {}) {
  if (!["side", "overlap", "agency"].includes(treatment)) throw new Error(`seamMarks: unknown treatment "${treatment}" (side, overlap or agency)`);
  if (treatment !== "agency" && rulers.length < 2) throw new Error("seamMarks: a seam needs two rulers");
  const line = (data, color, width, extra = {}) => Plot.lineY(data, { x: "date", y: "value", stroke: color, strokeWidth: width, strokeLinejoin: "round", strokeLinecap: "round", ...extra });
  const marks = [];
  let at = marker ? marker.at : null;
  rulers.forEach((r, i) => {
    const width = r.width ?? (i === rulers.length - 1 ? 2 : 1.75);
    const extra = r.opacity != null ? { strokeOpacity: r.opacity } : {};
    if (r.reconstructedUntil) {
      if (treatment !== "agency") throw new Error("seamMarks: only an agency seam has a reconstructed stretch");
      const cut = r.reconstructedUntil;
      // the measured stretch starts at the last reconstructed point, so the agency's line never breaks
      const lastBack = [...r.data].reverse().find((d) => d.date < cut);
      marks.push(line(r.data.filter((d) => d.date < cut), tint(r.color), width, extra));
      marks.push(line(r.data.filter((d) => d.date >= (lastBack ? lastBack.date : cut)), r.color, width, extra));
      at ??= cut;
    } else marks.push(line(r.data, r.color, width, extra));
  });
  if (treatment === "agency" && !rulers.some((r) => r.reconstructedUntil)) throw new Error("seamMarks: an agency seam needs the ruler's reconstructedUntil");
  if (!marker) return marks;
  if (treatment === "agency" && !/\b(NSO|MoSPI|RBI|Labour Bureau|OEA|agency|World Bank)\b/.test(marker.text || "")) throw new Error("seamMarks: an agency link must be labelled as the agency's (name it in marker.text)");
  at ??= treatment === "side" ? firstPublished(rulers.at(-1).data)?.date : lastPublished(rulers[0].data)?.date;
  marks.push(Plot.ruleX([at], { stroke: SEAM_RULE, strokeWidth: 1, ...(marker.solid ? {} : { strokeDasharray: "2,3" }) }));
  if (marker.text) {
    const anchor = marker.anchor ?? "end";
    marks.push(Plot.text([{ date: marker.textAt ?? at, value: marker.y }], { x: "date", y: "value", text: [marker.text], fontSize: marker.fontSize ?? 12, fill: "#5F6675", fontFamily: SANS, textAnchor: anchor, dx: marker.dx ?? (anchor === "end" ? -8 : anchor === "start" ? 8 : 0) }));
  }
  return marks;
}
/* The months (quarters, years) two rulers both describe: how many, the widest gap and
 * where, and the last shared point. For the plate's reading of an overlap seam. */
export function seamOverlap(a, b) {
  const byT = new Map(a.data.filter((d) => d.value != null).map((d) => [d.date.getTime(), d.value]));
  let n = 0, gap = 0, gapAt = null, last = null;
  for (const d of b.data) {
    const o = byT.get(d.date.getTime());
    if (o == null || d.value == null) continue;
    n++; last = { date: d.date, a: o, b: d.value };
    if (Math.abs(d.value - o) > gap) { gap = Math.abs(d.value - o); gapAt = d.date; }
  }
  return { n, gap, gapAt, last };
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
      Plot.ruleY([0], { stroke: "#ECEEF2" }),
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
