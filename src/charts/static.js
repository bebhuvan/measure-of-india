// src/charts/static.js: charts drawn at build time as SVG strings (no client JavaScript).
// Used where a chart is a reference, not an instrument: the small chart beside each guide on
// the home page and guides index, and the featured chart on the guides index. House style v3:
// ultramarine for the series, a pale tint for reconstructed history, hairline grid, Golos Text.
const C = { ink: "#161A22", ink3: "#6B7180", ink4: "#B5BAC4", grid: "#F0F2F5", base: "#D3D7DE", blue: "#2E4BD8", tint: "#AFBBF0", wash: "#F4F6FD" };
const mi = (iso) => +iso.slice(0, 4) * 12 + (+iso.slice(5, 7) - 1);
const f1 = (n) => n.toFixed(1);
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;");

/** A word-sized chart: a line with an end dot, or a two-round before-and-after. */
export function miniSVG({ dates, values, slope = false }, { w = 140, h = 42, label = "" } = {}) {
  const P = dates.map((d, i) => ({ t: mi(d), v: values[i] })).filter((p) => p.v != null);
  if (!P.length) return "";
  const lo = Math.min(...P.map((p) => p.v)), hi = Math.max(...P.map((p) => p.v));
  const t0 = P[0].t, t1 = P.at(-1).t;
  const x = (t) => 3 + (t - t0) / Math.max(1, t1 - t0) * (w - 8);
  const y = (v) => 4 + (hi - v) / ((hi - lo) || 1) * (h - 9);
  const aria = label ? ` role="img" aria-label="${esc(label)}"` : ` aria-hidden="true"`;
  if (slope) {
    const a = P[0], b = P.at(-1);
    return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"${aria}><line x1="${f1(x(a.t))}" x2="${f1(x(b.t))}" y1="${f1(y(a.v))}" y2="${f1(y(b.v))}" stroke="#B9C3F3" stroke-width="1.5"/>` +
      `<circle cx="${f1(x(a.t))}" cy="${f1(y(a.v))}" r="3" fill="#fff" stroke="${C.ink4}" stroke-width="1.25"/><circle cx="${f1(x(b.t))}" cy="${f1(y(b.v))}" r="3.25" fill="${C.blue}"/></svg>`;
  }
  const d = P.map((p, i) => `${i ? "L" : "M"}${f1(x(p.t))},${f1(y(p.v))}`).join("");
  const zero = lo < 0 && hi > 0 ? `<line x1="2" x2="${w - 3}" y1="${f1(y(0))}" y2="${f1(y(0))}" stroke="${C.base}"/>` : "";
  return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"${aria}>${zero}<path d="${d}" fill="none" stroke="${C.blue}" stroke-width="1.35" stroke-linejoin="round" stroke-linecap="round"/>` +
    `<circle cx="${f1(x(P.at(-1).t))}" cy="${f1(y(P.at(-1).v))}" r="2.4" fill="${C.blue}"/></svg>`;
}

/** A small reference line chart with a y axis, year ticks, an optional band and a tinted
 *  stretch of reconstructed history (before `liveFrom`). Drawn at a fixed width; CSS scales it. */
export function lineSVG({ dates, values }, { w = 640, h = 300, band = null, target = null, liveFrom = null, unit = "%", label = "", endLabel = "" } = {}) {
  const P = dates.map((d, i) => ({ t: mi(d), v: values[i] })).filter((p) => p.v != null);
  const m = { l: 38, r: 84, t: 12, b: 26 };
  const vs = P.map((p) => p.v).concat(band || []);
  const raw = (Math.max(...vs) - Math.min(0, ...vs)) / 4, p10 = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = [1, 2, 5, 10].map((k) => k * p10).find((s) => s >= raw);
  const lo = Math.floor(Math.min(0, ...vs) / step) * step, hi = Math.ceil(Math.max(...vs) / step) * step;
  const t0 = P[0].t, t1 = P.at(-1).t;
  const x = (t) => m.l + (t - t0) / Math.max(1, t1 - t0) * (w - m.l - m.r);
  const y = (v) => m.t + (hi - v) / (hi - lo) * (h - m.t - m.b);
  const out = [`<svg viewBox="0 0 ${w} ${h}" width="100%" role="img" aria-label="${esc(label)}" style="display:block;font-family:'Golos Text',system-ui,sans-serif">`];
  if (band) out.push(`<rect x="${m.l}" y="${f1(y(band[1]))}" width="${w - m.l - m.r}" height="${f1(y(band[0]) - y(band[1]))}" fill="${C.wash}"/>`);
  for (let v = lo; v <= hi + 1e-9; v += step) {
    out.push(`<line x1="${m.l}" x2="${w - m.r}" y1="${f1(y(v))}" y2="${f1(y(v))}" stroke="${v === 0 ? C.base : C.grid}"/>`);
    out.push(`<text x="${m.l - 8}" y="${f1(y(v) + 4)}" text-anchor="end" font-size="11.5" fill="${C.ink3}">${v}${v >= hi - 1e-9 ? unit : ""}</text>`);
  }
  if (target != null) out.push(`<line x1="${m.l}" x2="${w - m.r}" y1="${f1(y(target))}" y2="${f1(y(target))}" stroke="${C.ink}" stroke-opacity=".38" stroke-dasharray="1 3" stroke-linecap="round"/>`);
  const y0 = Math.ceil(t0 / 12), y1 = Math.floor(t1 / 12), every = y1 - y0 > 8 ? 3 : y1 - y0 > 4 ? 2 : 1;
  for (let yr = y1; yr >= y0; yr -= every) {
    const xx = x(yr * 12), full = yr === y1 || yr - every < y0;
    out.push(`<line x1="${f1(xx)}" x2="${f1(xx)}" y1="${h - m.b}" y2="${h - m.b + 4}" stroke="${C.base}"/>`);
    out.push(`<text x="${f1(xx)}" y="${h - 7}" text-anchor="middle" font-size="11.5" fill="${C.ink3}">${full ? yr : "’" + String(yr).slice(2)}</text>`);
  }
  const path = (A) => A.map((p, i) => `${i ? "L" : "M"}${f1(x(p.t))},${f1(y(p.v))}`).join("");
  const lf = liveFrom ? mi(liveFrom) : -Infinity, k = P.findIndex((p) => p.t >= lf);
  if (liveFrom && k > 0) {
    out.push(`<path d="${path(P.slice(0, k + 1))}" fill="none" stroke="${C.tint}" stroke-width="1.2" stroke-linejoin="round"/>`);
    out.push(`<path d="${path(P.slice(k))}" fill="none" stroke="${C.blue}" stroke-width="1.75" stroke-linejoin="round" stroke-linecap="round"/>`);
  } else out.push(`<path d="${path(P)}" fill="none" stroke="${C.blue}" stroke-width="1.75" stroke-linejoin="round" stroke-linecap="round"/>`);
  const e = P.at(-1);
  out.push(`<circle cx="${f1(x(e.t))}" cy="${f1(y(e.v))}" r="3" fill="${C.blue}" stroke="#fff" stroke-width="1.5"/>`);
  out.push(`<text x="${f1(x(e.t) + 10)}" y="${f1(y(e.v) + 1)}" font-size="14" font-weight="600" fill="${C.ink}">${e.v.toFixed(2)}${unit}</text>`);
  if (endLabel) out.push(`<text x="${f1(x(e.t) + 10)}" y="${f1(y(e.v) + 15)}" font-size="11.5" fill="${C.ink3}">${esc(endLabel)}</text>`);
  out.push(`</svg>`);
  return out.join("");
}

/** A briefing chart for the front page (DESIGN §0.8): quiet gridlines with their values on the
 *  left, an optional band and target with its label, years under the axis, the series in
 *  ultramarine with its end dot and the end value labelled in ink. Drawn at the width it is
 *  shown (no scaling), so the 12px text stays 12px; the page carries a desktop and a phone
 *  drawing and shows one. Same five-year window for every series it is used for. */
export function briefSVG({ dates, values }, { w = 440, h = 150, ref = null, refLabel = "", band = null, unit = "%", label = "", dp = 1, fs = 12, lines = 3 } = {}) {
  const P = dates.map((d, i) => ({ d, t: mi(d), v: values[i] })).filter((p) => p.v != null);
  const e = P.at(-1), endTxt = `${e.v < 0 ? "−" : ""}${Math.abs(e.v).toFixed(dp)}${unit}`;
  const m = { l: 30, r: endTxt.length * fs * 0.6 + 16, t: 10, b: 24 };
  const vs = P.map((p) => p.v).concat(ref != null ? [ref] : [], band || []);
  let lo = Math.min(...vs), hi = Math.max(...vs);
  const raw = (hi - lo) / lines, p10 = Math.pow(10, Math.floor(Math.log10(raw || 1)));
  const step = [1, 2, 2.5, 5, 10].map((k) => k * p10).find((x) => x >= raw);
  lo = Math.floor(lo / step) * step; hi = Math.ceil(hi / step) * step;
  if (hi === lo) hi = lo + step;
  const t0 = P[0].t, t1 = e.t;
  const x = (t) => m.l + (t - t0) / Math.max(1, t1 - t0) * (w - m.l - m.r);
  const y = (v) => m.t + (hi - v) / (hi - lo) * (h - m.t - m.b);
  const num = (v) => (v < 0 ? "−" : "") + String(+Math.abs(v).toFixed(2));
  const o = [`<svg viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img" aria-label="${esc(label)}" style="display:block;max-width:100%;height:auto;font-family:'Golos Text',system-ui,sans-serif">`];
  if (band) o.push(`<rect x="${m.l}" y="${f1(y(band[1]))}" width="${f1(w - m.l - m.r)}" height="${f1(y(band[0]) - y(band[1]))}" fill="${C.wash}"/>`);
  for (let v = lo; v <= hi + 1e-9; v += step) {
    o.push(`<line x1="${m.l}" x2="${f1(w - m.r)}" y1="${f1(y(v))}" y2="${f1(y(v))}" stroke="${Math.abs(v) < 1e-9 ? "#C9CED6" : "#E8EBEF"}"/>`);
    o.push(`<text x="${m.l - 7}" y="${f1(y(v) + fs * 0.34)}" text-anchor="end" font-size="${fs}" fill="#6B7180">${num(v)}</text>`);
  }
  if (ref != null) {
    o.push(`<line x1="${m.l}" x2="${f1(w - m.r)}" y1="${f1(y(ref))}" y2="${f1(y(ref))}" stroke="${C.ink}" stroke-opacity=".45" stroke-dasharray="1 3" stroke-linecap="round"/>`);
    if (refLabel) {
      // the label sits where the line leaves room: above or below the rule, scanning from the left
      const lw = refLabel.length * fs * 0.56 + 6, clear = (x0, top, bot) => P.every((p, i) => {
        const q = P[i + 1] || p, a = x(p.t), bx = x(q.t);
        if (Math.max(a, bx) < x0 - 3 || Math.min(a, bx) > x0 + lw + 3) return true;
        const ya = y(p.v), yb = y(q.v); return Math.max(ya, yb) < top - 2 || Math.min(ya, yb) > bot + 2; });
      let spot = null;
      for (let x0 = m.l + 4; x0 + lw < w - m.r && !spot; x0 += 4) {
        if (clear(x0, y(ref) - fs - 6, y(ref) - 2)) spot = [x0, y(ref) - 6];
        else if (clear(x0, y(ref) + 2, y(ref) + fs + 6)) spot = [x0, y(ref) + fs + 3];
      }
      if (spot) o.push(`<text x="${f1(spot[0])}" y="${f1(spot[1])}" font-size="${fs}" fill="#4A5160">${esc(refLabel)}</text>`);
    }
  }
  // years under the axis: every year that fits, the first and last in full
  const y0 = Math.ceil(t0 / 12), y1 = Math.floor(t1 / 12), span = Math.max(1, y1 - y0);
  const every = Math.ceil(span / Math.max(1, Math.floor((w - m.l - m.r) / (fs * 4.2))));
  for (let yr = y0; yr <= y1; yr += every) {
    const xx = x(yr * 12), full = yr === y0 || yr + every > y1;
    o.push(`<line x1="${f1(xx)}" x2="${f1(xx)}" y1="${h - m.b}" y2="${h - m.b + 4}" stroke="#C9CED6"/>`);
    o.push(`<text x="${f1(xx)}" y="${h - 6}" text-anchor="middle" font-size="${fs}" fill="#6B7180">${full ? yr : "’" + String(yr).slice(2)}</text>`);
  }
  const d = P.map((p, i) => `${i ? "L" : "M"}${f1(x(p.t))},${f1(y(p.v))}`).join("");
  o.push(`<path d="${d}" fill="none" stroke="${C.blue}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`);
  o.push(`<circle cx="${f1(x(e.t))}" cy="${f1(y(e.v))}" r="3.5" fill="${C.blue}" stroke="#fff" stroke-width="1.5"/>`);
  o.push(`<text x="${f1(x(e.t) + 9)}" y="${f1(y(e.v) + fs * 0.36)}" font-size="${fs + 1}" font-weight="600" fill="${C.ink}" stroke="#fff" stroke-width="4" paint-order="stroke" stroke-linejoin="round">${endTxt}</text>`);
  o.push(`</svg>`);
  return o.join("");
}
