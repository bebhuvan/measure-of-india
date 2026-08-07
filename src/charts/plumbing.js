// src/charts/plumbing.js — shared chart plumbing for every dossier plate.
// Extracted from site/dossiers/cpi.html (the reference implementation).
// Behaviour is normative; do not restyle. The only change from the reference
// is parameterisation: functions take explicit series/geo args instead of
// closing over page-level globals.

import * as Plot from "@observablehq/plot";

export const MONO = "'IBM Plex Mono', monospace";

/* ---------- downloads ---------- */
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
  parts.push(`<text x="${totalW - pad}" y="${brandY}" text-anchor="end" font-family="'IBM Plex Mono', monospace" font-size="10.5" letter-spacing="0.8" fill="#8A857A">INDIA ATLAS · INDIAATLAS.IN</text>`);
  parts.push(`</svg>`);
  return { svg: parts.join(""), width: totalW, height: totalH };
}

export function saveBlob(blob, filename) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
export function downloadSVG(svg, filename, meta) {
  const out = meta ? composeCardSVG(svg, meta).svg : serializeSVG(svg);
  saveBlob(new Blob([out], { type: "image/svg+xml" }), filename + ".svg");
}
export function downloadPNG(svg, filename, meta) {
  const card = meta ? composeCardSVG(svg, meta) : { svg: serializeSVG(svg), width: +svg.getAttribute("width"), height: +svg.getAttribute("height") };
  const url = URL.createObjectURL(new Blob([card.svg], { type: "image/svg+xml" }));
  const img = new Image();
  img.onload = () => {
    const scale = 2, canvas = document.createElement("canvas");
    canvas.width = card.width * scale;
    canvas.height = card.height * scale;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    URL.revokeObjectURL(url);
    canvas.toBlob((b) => saveBlob(b, filename + ".png"), "image/png");
  };
  img.src = url;
}
export function downloadCSV(seriesList, filename, fmtDate) {
  const header = ["date", ...seriesList.map((s) => s.name)];
  const rows = seriesList[0].data.map((d, i) => [
    fmtDate ? fmtDate(d.date) : d.date.toISOString().slice(0, 10),
    ...seriesList.map((s) => s.data[i].value),
  ]);
  const csv = [header, ...rows].map((r) => r.join(",")).join("\n");
  saveBlob(new Blob([csv], { type: "text/csv" }), filename + ".csv");
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
 * geo contract: {W,H,ml,mr,mt,mb,d0,d1} must exactly match the plot's
 * width/height/margins/y-domain or the crosshair drifts. */
export function addCrosshair(container, plot, seriesList, geo, fmtDate, fmtV = (v) => v.toFixed(2) + "%") {
  const { W, H, ml, mr, mt, mb, d0, d1 } = geo;
  const ns = "http://www.w3.org/2000/svg";
  const t0 = seriesList[0].data[0].date.getTime(), t1 = seriesList[0].data.at(-1).date.getTime();
  const xPix = (d) => ml + ((d.getTime() - t0) / (t1 - t0)) * (W - ml - mr);
  const yPix = (v) => mt + (1 - (v - d0) / (d1 - d0)) * (H - mt - mb);
  const rule = document.createElementNS(ns, "line");
  rule.setAttribute("stroke", "#1B1A17");
  rule.setAttribute("stroke-width", "1");
  rule.setAttribute("y1", mt);
  rule.setAttribute("y2", H - mb);
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
  const tip = container.querySelector(".cb-tip");
  plot.addEventListener("pointermove", (e) => {
    const rect = plot.getBoundingClientRect();
    const px = (e.clientX - rect.left) * (W / rect.width);
    let t = (px - ml) / (W - ml - mr);
    if (t < 0 || t > 1) return;
    const target = t0 + t * (t1 - t0);
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
      dots[k].setAttribute("cx", x);
      dots[k].setAttribute("cy", yPix(s.data[i].value));
      dots[k].style.display = "";
    });
    tip.innerHTML = `<div class="d">${fmtDate(d)}</div>` +
      seriesList.map((s) => `<div class="r"><span class="sw2" style="background:${s.color}"></span><span class="n">${s.label}</span><span class="v">${fmtV(s.data[i].value)}</span></div>`).join("");
    tip.style.display = "block";
    const flip = x > W * 0.72;
    tip.style.left = (flip ? x - 16 - tip.offsetWidth : x + 16) + "px";
    tip.style.top = Math.max(10, yPix(seriesList[0].data[i].value) - 40) + "px";
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
export function peakOf(s) {
  let p = s.data[0];
  for (const d of s.data) if (d.value > p.value) p = d;
  return p;
}
export function troughOf(s) {
  let p = s.data[0];
  for (const d of s.data) if (d.value < p.value) p = d;
  return p;
}
export function peakBetween(s, a, b) {
  // a,b may be years (numbers) or Dates
  const lo = a instanceof Date ? a : new Date(Date.UTC(a, 0, 1));
  const hi = b instanceof Date ? b : new Date(Date.UTC(b, 11, 31));
  let p = null;
  for (const d of s.data) if (d.date >= lo && d.date <= hi && (!p || d.value > p.value)) p = d;
  return p;
}
export function dodgeEndLabels(seriesList, gap) {
  const pts = seriesList.map((s) => ({ key: s.label, value: s.data.at(-1).value, y: s.data.at(-1).value, s }));
  pts.sort((a, b) => b.y - a.y);
  for (let i = 1; i < pts.length; i++) if (pts[i - 1].y - pts[i].y < gap) pts[i].y = pts[i - 1].y - gap;
  return pts;
}

/* ---------- sparkline ---------- */
export function spark(id, s) {
  const vs = s.data.map((d) => d.value);
  const plot = Plot.plot({
    width: 190, height: 44,
    marginLeft: 0, marginRight: 0, marginTop: 4, marginBottom: 4,
    style: { background: "transparent" },
    x: { axis: null },
    y: { axis: null, domain: [Math.min(...vs, 0), Math.max(...vs)] },
    marks: [
      Plot.ruleY([0], { stroke: "#E6E2D6" }),
      Plot.lineY(s.data, { x: "date", y: "value", stroke: s.color, strokeWidth: 1.5, strokeLinejoin: "round" }),
      Plot.dot([s.data.at(-1)], { x: "date", y: "value", fill: s.color, r: 2.5, stroke: "#FFFFFF", strokeWidth: 1 }),
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
