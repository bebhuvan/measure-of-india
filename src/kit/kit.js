// India Atlas chart kit, v5 (from scratch, 2026-10-15).
//
// One module, no dependencies. Every form takes a plain spec and returns an SVG string, so
// the same code can run at build time (Node) or in the page. Hover is a separate, optional
// enhancement (enhance()), never needed to read a value.
//
// Grammar (the house rules every form obeys):
//  - Horizontal hairline gridlines only. Y labels sit on their gridline at the left edge,
//    the unit only on the top label. A solid baseline at zero when zero is in the domain.
//  - Direct labels at the end of lines and bars; a legend only when labels cannot reach.
//  - One lead colour (indigo) for the series the finding is about, greys for context,
//    sindoor for the one comparison. Text is never in a series colour.
//  - Indian number formats (12,34,567; lakh crore), a true minus sign, tabular figures
//    on axes and in columns.
//  - Nulls are gaps. A change of base is a seam, drawn and named, never joined.

import METRICS from './metrics.js';

export const C = {
  ink: '#15171A', ink2: '#3D4148', muted: '#6B7078', faint: '#9CA0A7',
  grid: '#E6E7E9', base: '#1E2126', ctx: '#A7ABB2', ctx2: '#CBCED3', wash: '#F4F5F6', paper: '#FFFFFF',
  lead: '#2E4BC4', leadTint: '#AAB4D8', leadSoft: '#8C9BD3', leadWash: '#F0F2FA',
  comp: '#D04A2E', compTint: '#E9B6AA',
  teal: '#00897A', turmeric: '#B57D00', plum: '#93479A',
  seq: ['#E9EDF9', '#C3CDF0', '#8FA2E2', '#5874D2', '#2E4BC4', '#1C2F86'],
};
export const CAT = [C.lead, C.comp, C.teal, C.turmeric, C.plum];

// ---------------------------------------------------------------------------- text
// Labels are placed before any browser sees them, so widths come from the chart face's own
// advance widths (src/kit/metrics.js, made by scripts/kit-metrics.py from the self-hosted
// Libre Franklin). A character the face lacks is measured as a wide glyph, never as zero.
const WEIGHTS = [400, 500, 600, 700];
let measurer = (text, size = 12, weight = 400) => {
  const k = WEIGHTS.reduce((a, b) => Math.abs(b - weight) < Math.abs(a - weight) ? b : a);
  const m = METRICS[k]; let u = 0;
  for (const ch of text) u += m[ch] ?? 640;
  return u / 1000 * size;
};
export function setMeasure(fn) { measurer = fn; }
export const tw = (t, s, w) => measurer(String(t), s, w);
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
const r1 = n => Math.round(n * 10) / 10;
function wrap(text, width, size = 12, weight = 400, maxLines = 3) {
  const words = String(text).split(/\s+/), lines = [];
  let cur = '';
  for (const w of words) {
    const t = cur ? cur + ' ' + w : w;
    if (tw(t, size, weight) <= width || !cur) cur = t; else { lines.push(cur); cur = w; }
  }
  if (cur) lines.push(cur);
  if (lines.length > maxLines) { const k = lines.slice(0, maxLines); k[maxLines - 1] += '…'; return k; }
  return lines;
}

// ---------------------------------------------------------------------------- numbers
const MINUS = '−';
export function inGroup(n) { // Indian digit grouping: 12,34,567
  const [i, f] = String(Math.abs(n)).split('.');
  const last3 = i.slice(-3), rest = i.slice(0, -3);
  const g = (rest ? rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',') + ',' : '') + last3;
  return (n < 0 ? MINUS : '') + g + (f ? '.' + f : '');
}
export function num(v, { dp = 1, sign = false, suffix = '', prefix = '', group = true } = {}) {
  if (v == null || !isFinite(v)) return '–';
  const a = Math.abs(v).toFixed(dp);
  const body = group ? inGroup(+a).replace(MINUS, '') : a;
  const fixed = dp > 0 && !body.includes('.') ? body + '.' + '0'.repeat(dp) : body;
  const s = v < 0 && +a !== 0 ? MINUS : sign && +a !== 0 ? '+' : '';
  return s + prefix + fixed + suffix;
}
const dpOf = step => { const t = String(+step.toFixed(10)); return t.includes('.') ? t.split('.')[1].length : 0; };

// ---------------------------------------------------------------------------- scales
export const lin = (d0, d1, r0, r1) => v => r0 + (v - d0) / ((d1 - d0) || 1) * (r1 - r0);
export function nice(min, max, count = 5) {
  if (min === max) { min -= 1; max += 1; }
  const raw = (max - min) / count, mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 5, 10].map(m => m * mag).find(s => s >= raw); // no 2.5: ticks read as whole numbers
  const lo = Math.floor(min / step + 1e-9) * step, hi = Math.ceil(max / step - 1e-9) * step;
  const ticks = []; for (let v = lo; v <= hi + step / 2; v += step) ticks.push(+v.toFixed(10));
  return { lo, hi, step, ticks };
}
// time: 'YYYY', 'YYYY-MM' or 'YYYY-MM-DD' -> fractional year
export function tnum(d) {
  const [y, m = 1, dd = 1] = String(d).split('-').map(Number);
  return y + (m - 1) / 12 + (dd - 1) / 365;
}
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export function tlabel(d, freq) {
  const [y, m] = String(d).split('-');
  if (freq === 'year' || !m) return y;
  if (freq === 'quarter') return `${MON[+m - 1]}–${MON[(+m + 1) % 12]} ${y}`;
  return `${MON[+m - 1]} ${y}`;
}
function timeTicks(t0, t1, width) {
  const span = t1 - t0, minGap = 64;
  const fit = Math.max(1, Math.floor(width / minGap));
  if (span <= 2.2) { // month ticks
    const steps = [1, 2, 3, 6]; const months = Math.round(span * 12);
    const st = steps.find(s => months / s <= fit) ?? 12;
    const out = []; let m = Math.ceil(t0 * 12 - 1e-6);
    for (; m <= t1 * 12 + 1e-6; m++) if (m % st === 0) out.push({ t: m / 12, label: MON[((m % 12) + 12) % 12] + (m % 12 === 0 || !out.length ? ' ' + Math.floor(m / 12) : '') });
    return out;
  }
  const steps = [1, 2, 5, 10, 20, 25, 50];
  const st = steps.find(s => span / s <= fit) ?? 100;
  const out = [];
  for (let y = Math.ceil(t0 / st) * st; y <= t1 + 1e-6; y += st) out.push({ t: y, label: String(y) });
  return out;
}

// ---------------------------------------------------------------------------- svg bits
const T = (x, y, s, { size = 12, fill = C.muted, anchor = 'start', weight = 400, cls = '', halo = false, base = 'auto' } = {}) =>
  `<text x="${r1(x)}" y="${r1(y)}" font-size="${size}" fill="${fill}"${anchor !== 'start' ? ` text-anchor="${anchor}"` : ''}${weight !== 400 ? ` font-weight="${weight}"` : ''}${cls ? ` class="${cls}"` : ''}${halo ? ' class="halo"' : ''}${base !== 'auto' ? ` dominant-baseline="${base}"` : ''}>${esc(s)}</text>`;
const Lh = (x1, x2, y, stroke, w = 1) => `<line x1="${r1(x1)}" x2="${r1(x2)}" y1="${r1(y) + .5}" y2="${r1(y) + .5}" stroke="${stroke}" stroke-width="${w}"/>`;
const Lv = (x, y1, y2, stroke, w = 1, dash = '') => `<line x1="${r1(x) + .5}" x2="${r1(x) + .5}" y1="${r1(y1)}" y2="${r1(y2)}" stroke="${stroke}" stroke-width="${w}"${dash ? ` stroke-dasharray="${dash}"` : ''}/>`;
const svgOpen = (w, h, label, extra = '') => `<svg class="ak" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(label ?? '')}"${extra}>`;

// The y axis every continuous form shares: gridlines across, labels sitting on them at left.
export function gutterFor(ticks, unit = {}, dp) {
  const top = ticks.at(-1);
  return Math.ceil(Math.max(...ticks.map(v => tw(num(v, { dp, prefix: v === top ? unit.prefix ?? '' : '', suffix: v === top ? unit.suffix ?? '' : '' }), 12)))) + 10;
}
function yAxis({ ticks, y, x0, x1, unit = {}, dp }) {
  const top = ticks.at(-1);
  let s = '';
  for (const v of ticks) {
    const isZero = v === 0;
    s += Lh(x0, x1, y(v), isZero ? C.base : C.grid, 1);
    const lab = num(v, { dp, group: true, prefix: v === top ? unit.prefix ?? '' : '', suffix: v === top ? unit.suffix ?? '' : '' });
    s += T(x0, y(v) - 5, lab, { size: 12, fill: C.muted, cls: 'tab halo' });
  }
  return s;
}
function xTimeAxis({ ticks, x, y, tick = true, lo = 0, hi = Infinity }) {
  let s = '';
  for (const k of ticks) {
    const half = tw(k.label, 12) / 2;
    if (x(k.t) - half < lo - 2 || x(k.t) + half > hi + 2) continue;
    if (tick) s += Lv(x(k.t), y, y + 5, C.base);
    s += T(x(k.t), y + 19, k.label, { size: 12, fill: C.muted, anchor: 'middle', cls: 'tab' });
  }
  return s;
}

// Resolve vertical collisions between end labels: keep order, push apart, stay in bounds.
function settle(items, gap, lo, hi) {
  const a = items.slice().sort((p, q) => p.y - q.y);
  for (let it = 0; it < 60; it++) {
    let moved = false;
    for (let i = 1; i < a.length; i++) {
      const need = a[i - 1].y + (a[i - 1].h ?? gap) - a[i].y;
      if (need > 0) { a[i - 1].y -= need / 2; a[i].y += need / 2; moved = true; }
    }
    for (const p of a) { p.y = Math.max(lo, Math.min(hi - (p.h ?? gap), p.y)); }
    if (!moved) break;
  }
  return a;
}

// Label placement against what is drawn. A label is a box; the series are polylines (segments,
// so a steep stroke between two points counts); boxes already placed count too. clearance()
// is the gap in px between the box and the nearest ink, negative when they touch.
function segsOf(series, x, y) {
  const out = [];
  for (const s of series) { let prev = null; for (const p of s.pts) { if (p.v == null) { prev = null; continue; } const q = [x(p.t), y(p.v)]; if (prev) out.push([prev[0], prev[1], q[0], q[1]]); else out.push([q[0], q[1], q[0], q[1]]); prev = q; } }
  return out;
}
function clearance(box, segs, taken = []) {
  let c = 99;
  for (const [ax, ay, bx, by] of segs) {
    const l = Math.min(ax, bx), r = Math.max(ax, bx);
    if (r < box.x0 || l > box.x1) continue;
    const at = t => ax === bx ? null : ay + (by - ay) * (t - ax) / (bx - ax);
    const lo = Math.max(l, box.x0), hi = Math.min(r, box.x1);
    const ys = ax === bx ? [ay, by] : [at(lo), at(hi)];
    const y0 = Math.min(...ys), y1 = Math.max(...ys);
    c = Math.min(c, y1 < box.y0 ? box.y0 - y1 : y0 > box.y1 ? y0 - box.y1 : -1);
  }
  for (const t of taken) {
    if (t.x1 < box.x0 || t.x0 > box.x1) continue;
    c = Math.min(c, t.y1 < box.y0 ? box.y0 - t.y1 : t.y0 > box.y1 ? t.y0 - box.y1 : -1);
  }
  return c;
}
// Sweep x across the plot for each candidate baseline; keep the clearest spot (earlier
// candidates win ties, so the natural place is kept when it is free). Returns {x, ly, clear}.
function placeLabel(w, baselines, segs, taken, x0, x1, size = 11.5) {
  let best = { x: x0 + 6, ly: baselines[0], clear: -Infinity };
  baselines.forEach((ly, j) => {
    for (let k = 0; k <= 40; k++) {
      const cx = x0 + 6 + (x1 - x0 - w - 12) * k / 40;
      const c = Math.min(clearance({ x0: cx - 3, x1: cx + w + 3, y0: ly - size + 1, y1: ly + 3 }, segs, taken), 12) - j * 0.5;
      if (c > best.clear + 0.5) best = { x: cx, ly, clear: c };
    }
  });
  return best;
}

// Vertical rules in row charts. Desktop: one rule top to bottom. Phone (names set above
// each row): a short segment per row, beside the marks only.
function rowRules(xv, y0, y1, bands, stroke, w = 1, extra = '') {
  if (!bands) return Lv(xv, y0, y1, stroke, w).replace('/>', extra + '/>');
  return bands.map(([a, b]) => Lv(xv, a, b, stroke, w).replace('/>', extra + '/>')).join('');
}

// Hover data rides on the svg itself (data-ak), so the page needs no chart code to read it:
// the plot's pixel and value extents, the frequency, the unit, and each series' points.
const hoverAttr = o => ` data-ak='${JSON.stringify(o).replace(/&/g, '&amp;').replace(/'/g, '&#39;').replace(/</g, '&lt;')}'`;

// ============================================================================ LINE
// spec: { width, height?, series:[{name, data:[[date,v]], role:'lead'|'ctx'|'comp'|'cat', color?, step?, label?}],
//         unit:{prefix,suffix}, dp, yDomain?, band:{from,to,label}, refs:[{y,label}], events:[{t,label}],
//         shade:[{from,to,label}], seam:{t,before,after}, freq, endFormat? }
export const line = (spec) => finish(_line(spec));
function _line(spec) {
  const W = spec.width, phone = W < 520;
  const H = spec.height ?? (phone ? 260 : Math.round(Math.min(420, Math.max(300, W * 0.42))));
  const S = spec.series.map((s, i) => ({ ...s, pts: s.data.map(([d, v]) => ({ d, t: tnum(d), v })) }));
  const all = S.flatMap(s => s.pts.filter(p => p.v != null));
  const t0 = spec.tDomain?.[0] ?? Math.min(...all.map(p => p.t)), t1 = spec.tDomain?.[1] ?? Math.max(...all.map(p => p.t));
  let vmin = Math.min(...all.map(p => p.v), ...(spec.band ? [spec.band.from] : []), ...(spec.refs ?? []).map(r => r.y));
  let vmax = Math.max(...all.map(p => p.v), ...(spec.band ? [spec.band.to] : []), ...(spec.refs ?? []).map(r => r.y));
  if (spec.zero !== false && vmin > 0 && vmin < (vmax - vmin) * 0.6) vmin = 0;
  let N = nice(...(spec.yDomain ?? [vmin, vmax]), phone ? 4 : 5);
  if (vmin > 0 && Math.abs(vmin - N.lo) < N.step * 0.15) N = { ...N, lo: N.lo - N.step * 0.3 };
  const dp = spec.dp ?? dpOf(N.step);
  const fmtEnd = spec.endFormat ?? (v => num(v, { dp: spec.endDp ?? 1, prefix: spec.unit?.prefix ?? '', suffix: spec.unit?.suffix ?? '' }));

  // end labels decide the right margin
  const labelled = S.filter(s => s.label !== false && s.pts.some(p => p.v != null));
  const endText = s => { const last = s.pts.filter(p => p.v != null).at(-1); return { v: fmtEnd(last.v), n: s.short ?? s.name }; };
  const maxLab = Math.max(0, ...labelled.map(s => { const e = endText(s); return Math.max(tw(e.v, 13, 600), spec.endSub ? tw(spec.endSub, 12) : spec.nameOnEnd === false ? 0 : tw(e.n, 12)); }));
  const inside = phone && labelled.length === 1;
  const right = inside ? 6 : labelled.length ? Math.min(phone ? 92 : 170, maxLab + 14) : 8;
  const top = 26 + (spec.events?.length || spec.seam ? 18 : 0), bottom = 30;
  const G = gutterFor(N.ticks, spec.unit, dp);
  const x = lin(t0, t1, G, W - right), y = lin(N.lo, N.hi, H - bottom, top);
  const colorOf = s => s.color ?? (s.role === 'lead' ? C.lead : s.role === 'comp' ? C.comp : s.role === 'ctx2' ? C.ctx2 : C.ctx);
  let s = svgOpen(W, H, spec.title, hoverAttr({
    x: [r1(G), r1(x(t1)), t0, t1], y: [r1(y(N.lo)), r1(y(N.hi)), N.lo, N.hi], f: spec.freq ?? 'month',
    u: [spec.unit?.prefix ?? '', spec.unit?.suffix ?? '', spec.hoverDp ?? spec.endDp ?? 1],
    s: S.filter(sr => sr.hover !== false).map(sr => [sr.name, colorOf(sr), sr.pts.map(p => [p.d, p.v])]),
  }));

  // shaded periods (reconstructed history, recessions) under everything
  for (const sh of spec.shade ?? []) {
    const a = x(tnum(sh.from)), b = x(tnum(sh.to));
    s += `<rect x="${r1(a)}" y="${top}" width="${r1(b - a)}" height="${r1(H - bottom - top)}" fill="${C.wash}"/>`;
    if (sh.label) s += T(a + 6, top + 14, sh.label, { size: 11.5, fill: C.muted });
  }
  if (spec.band) {
    const b0 = y(spec.band.to), b1 = y(spec.band.from);
    s += `<rect x="${G}" y="${r1(b0)}" width="${r1(x(t1) - G)}" height="${r1(b1 - b0)}" fill="${C.leadWash}"/>`;
  }
  s += yAxis({ ticks: N.ticks.filter(v => v >= N.lo - 1e-9), y, x0: 0, x1: W, unit: spec.unit, dp });
  // band and reference labels sit inside the plot's top-left, clear of the end labels
  const inPlot = []; // labels placed after the series are known
  if (spec.band?.label) { const bt = y(spec.band.to), bb = y(spec.band.from); inPlot.push({ text: spec.band.label, key: 'Shaded: ' + spec.band.label, ly: [bt + 15, bb - 5, bt - 5, bb + 15] }); }
  for (const r of spec.refs ?? []) {
    s += Lh(G, x(t1), y(r.y), C.ink2, 1).replace('/>', ' stroke-dasharray="1 3" stroke-linecap="round"/>');
    if (r.label) inPlot.push({ text: r.label, key: 'Dotted line: ' + r.label, ly: [y(r.y) - 6, y(r.y) + 15] });
  }
  if (N.lo !== 0) s += Lh(0, W, H - bottom, C.base, 1);
  s += xTimeAxis({ ticks: timeTicks(t0, t1, W - right - G), x, y: H - bottom, lo: 0, hi: W });

  // events and seams: a hairline from the top, the label above the plot
  const evRows = [], vrules = [];
  for (const e of spec.events ?? []) {
    const ex = x(tnum(e.t)), text = phone && e.short ? e.short : e.label, w = tw(text, 11.5);
    const left = e.side === 'left' || ex + 5 + w > W;
    const [a, b] = left ? [ex - 5 - w, ex] : [ex, ex + 5 + w];
    let row = 0; while (evRows.some(r => r.row === row && a < r.b + 8 && b > r.a - 8)) row++;
    evRows.push({ row, a, b });
    s += Lv(ex, top - 6 + row * 14, H - bottom, C.faint, 1); vrules.push(ex);
    s += T(left ? ex - 5 : ex + 5, top - 8 + row * 14, text, { size: 11.5, fill: C.ink2, anchor: left ? 'end' : 'start', cls: 'halo' });
  }
  if (spec.seam) {
    const sx = x(tnum(spec.seam.t));
    s += Lv(sx, top - 14, H - bottom, C.faint, 1); vrules.push(sx);
    const aft = spec.seam.after + ' →', fits = sx + 6 + tw(aft, 11.5, 500) <= W;
    if (fits) { s += T(sx - 6, top - 16, '← ' + spec.seam.before, { size: 11.5, fill: C.muted, anchor: 'end' }); s += T(sx + 6, top - 16, aft, { size: 11.5, fill: C.ink2, weight: 500 }); }
    else { // no room right of the seam: the live label ends at the edge, the back-cast label sits left of the rule
      s += T(sx - 6, top - 16, '← ' + spec.seam.before, { size: 11.5, fill: C.muted, anchor: 'end' });
      s += T(W, top - 30, aft.replace(' →', '') + ' ↓', { size: 11.5, fill: C.ink2, weight: 500, anchor: 'end' }); }
  }

  // series: context first, lead last (on top)
  const order = { ctx: 0, cat: 1, comp: 2, lead: 3 };
  for (const sr of S.slice().sort((a, b) => (order[a.role] ?? 1) - (order[b.role] ?? 1))) {
    const col = colorOf(sr), w = sr.role === 'lead' || sr.role === 'comp' ? 2 : sr.role === 'cat' ? 2 : 1.5;
    let d = '', pen = false, prev = null;
    for (const p of sr.pts) {
      if (p.v == null) { pen = false; continue; }
      if (sr.step && pen) d += `H${r1(x(p.t))}V${r1(y(p.v))}`;
      else d += `${pen ? 'L' : 'M'}${r1(x(p.t))},${r1(y(p.v))}`;
      pen = true; prev = p;
    }
    if (sr.step && prev && spec.stepTo) d += `H${r1(x(tnum(spec.stepTo)))}`;
    if (sr.area) {
      const segs = d.split('M').filter(Boolean);
      for (const g of segs) { const pts = g.split(/[LHV]/); const first = pts[0].split(',')[0]; const lastX = (g.match(/[\d.]+(?=,[\d.-]+$)/) ?? [first])[0];
        s += `<path d="M${g}L${lastX},${r1(y(Math.max(N.lo, 0)))}L${first},${r1(y(Math.max(N.lo, 0)))}Z" fill="${col}" fill-opacity=".08"/>`; }
    }
    if (sr.recon) { // history the agency reconstructed: same ruler, drawn lighter up to the seam
      const cut = tnum(sr.recon), a = sr.pts.filter(p => p.t <= cut + 1e-6 && p.v != null), b = sr.pts.filter(p => p.t >= cut - 1 / 12 - 1e-6 && p.v != null);
      const path = P => P.map((p, i) => `${i ? 'L' : 'M'}${r1(x(p.t))},${r1(y(p.v))}`).join('');
      s += `<path d="${path(a)}" fill="none" stroke="${C.leadSoft}" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round"/>`;
      s += `<path d="${path(b)}" fill="none" stroke="${col}" stroke-width="${w}" stroke-linejoin="round" stroke-linecap="round"/>`;
      continue;
    }
    s += `<path d="${d}" fill="none" stroke="${col}" stroke-width="${w}" stroke-linejoin="round" stroke-linecap="round"${sr.dash ? ` stroke-dasharray="${sr.dash}"` : ''}/>`;
  }
  // notes on single points: a ringed dot, a short leader, two lines of text
  const noteBoxes = [];
  const noteSegs = segsOf(S, x, y).concat(vrules.map(vx => [vx, top - 30, vx, H - bottom]));
  for (const n of spec.notes ?? []) {
    const px = x(tnum(n.d)), py = y(n.v), lines = n.text.split('\n');
    const nw = Math.max(...lines.map((ln, k) => tw(ln, 12, k ? 400 : 600))), nh = lines.length * 14;
    // the asked-for side and height first, then the others; the clearest wins
    const pref = [[n.side ?? 'right', n.below ?? false], [n.side ?? 'right', !(n.below ?? false)], [(n.side ?? 'right') === 'right' ? 'left' : 'right', n.below ?? false], [(n.side ?? 'right') === 'right' ? 'left' : 'right', !(n.below ?? false)]];
    const fits = ([sd, bl]) => { const tx = sd === 'right' ? px + 14 : px - 14, ty = bl ? py + 22 : py - 14 - (lines.length - 1) * 14; const x0 = sd === 'right' ? tx : tx - nw;
      if (x0 < 0 || x0 + nw > W || ty - 11 < 0 || ty + nh - 14 > H - bottom) return -99; return clearance({ x0: x0 - 3, x1: x0 + nw + 3, y0: ty - 11, y1: ty + nh - 11 }, noteSegs, []); };
    const [side, below] = pref.reduce((a, b) => fits(b) > fits(a) + 1 ? b : a, pref[0]);
    const tx = side === 'right' ? px + 14 : px - 14, anchor = side === 'right' ? 'start' : 'end';
    const ty = below ? py + 22 : py - 14 - (lines.length - 1) * 14;
    { const x0 = side === 'right' ? tx : tx - nw; noteBoxes.push({ x0: x0 - 3, x1: x0 + nw + 3, y0: ty - 12, y1: ty + nh - 10 }); }
    s += `<circle cx="${r1(px)}" cy="${r1(py)}" r="4" fill="none" stroke="${C.ink}" stroke-width="1.25"/>`;
    const ly = below ? ty - 11 : ty + (lines.length - 1) * 14 + 4;
    s += `<path d="M${r1(px + (side === 'right' ? 4 : -4))},${r1(py - (below ? -4 : 4))}L${r1(tx + (side === 'right' ? -4 : 4))},${r1(ly)}" stroke="${C.ink}" stroke-width="1" fill="none"/>`;
    lines.forEach((ln, k) => { s += T(tx, ty + k * 14, ln, { size: 12, fill: k ? C.ink2 : C.ink, weight: k ? 400 : 600, anchor, cls: 'halo' }); });
  }
  // in-plot labels go where no stroke and no other label is; one that finds no clear spot
  // becomes a line of the key under the chart instead of sitting on the data
  const segs = segsOf(S, x, y), taken = [...noteBoxes], keyNotes = [];
  if (inside) { const lp = labelled[0].pts.filter(p => p.v != null).at(-1), ex = x(lp.t), ey = y(lp.v), w = tw(fmtEnd(lp.v), 13, 600); taken.push({ x0: ex - w - 8, x1: ex + 6, y0: ey - 40, y1: ey + 40 }); }
  for (const l of inPlot) {
    const w = tw(l.text, 11.5), cands = l.ly.filter(v => v - 11 > top - 2 && v < H - bottom - 2);
    const spot = placeLabel(w, cands.length ? cands : [l.ly[0]], segs, taken, G, x(t1));
    if (spot.clear < 1.5) { keyNotes.push(l.key); continue; }
    taken.push({ x0: spot.x - 3, x1: spot.x + w + 3, y0: spot.ly - 11, y1: spot.ly + 3 });
    s += T(spot.x, spot.ly, l.text, { size: 11.5, fill: C.ink2, cls: 'halo' });
  }
  // end dots and labels
  const ends = labelled.map(sr => {
    const last = sr.pts.filter(p => p.v != null).at(-1), e = endText(sr);
    const two = (spec.nameOnEnd !== false && labelled.length > 1) || !!spec.endSub;
    if (spec.endSub) e.n = spec.endSub;
    return { sr, last, e, two, y: y(last.v) - (two ? 12 : 5), h: two ? 30 : 16 };
  });
  if (inside) {
    const p = ends[0], col = colorOf(p.sr), ex = x(p.last.t), ey = y(p.last.v);
    s += `<circle cx="${r1(ex)}" cy="${r1(ey)}" r="3.75" fill="${col}" stroke="#fff" stroke-width="2"/>`;
    // above or below the last point, whichever stays clearer of the line
    const w = tw(p.e.v, 13, 600), pts = S.flatMap(sr => sr.pts.filter(q => q.v != null).map(q => [x(q.t), y(q.v)])).filter(([px]) => px >= ex - w - 8 && px <= ex);
    const clear = ly => Math.min(...pts.map(([, py]) => Math.max(py - ly - 3, ly - 13 - py)), 99);
    const cands = [ey - 11, ey + 21, ey - 26, ey + 36].filter(ly => ly - 12 > top - 14 && ly < H - bottom - 2);
    const ly = cands.reduce((a, b) => clear(b) > clear(a) + 2 ? b : a, cands[0] ?? ey - 11);
    s += T(ex - 2, ly, p.e.v, { size: 13, fill: C.ink, weight: 600, anchor: 'end', cls: 'tab halo' });
  }
  else for (const p of settle(ends, 16, top - 4, H - bottom + 4)) {
    const lx = x(t1) + 10, col = colorOf(p.sr), ey = y(p.last.v);
    s += `<circle cx="${r1(x(p.last.t))}" cy="${r1(ey)}" r="3.75" fill="${col}" stroke="#fff" stroke-width="2"/>`;
    const ly = p.y + (p.two ? 12 : 5);
    if (Math.abs(ly - ey) > 6) s += `<path d="M${r1(x(p.last.t) + 5)},${r1(ey)}L${r1(lx - 3)},${r1(ly - 4)}" stroke="${C.faint}" fill="none"/>`;
    s += T(lx, ly, p.e.v, { size: 13, fill: C.ink, weight: 600, cls: 'tab' });
    if (p.two) s += T(lx, ly + 15, phone ? p.e.n.split(' ')[0] : p.e.n, { size: 12, fill: C.ink2 });
  }
  s += `<rect class="ak-hit" x="${G}" y="${top}" width="${r1(x(t1) - G)}" height="${r1(H - bottom - top)}" fill="transparent"/>`;
  if (keyNotes.length) { // the key: one wrapped line under the axis
    const lines = wrap(keyNotes.join('   ·   '), W - 4, 12, 400, 3), H2 = H + 6 + lines.length * 16;
    s = s.replace(`height="${H}" viewBox="0 0 ${W} ${H}"`, `height="${H2}" viewBox="0 0 ${W} ${H2}"`);
    lines.forEach((ln, k) => { s += T(0, H + 10 + k * 16, ln, { size: 12, fill: C.muted }); });
  }
  return s + '</svg>';
}

// ============================================================================ COLUMNS
// spec: { width, data:[[date,v]], unit, dp, highlight:'last'|'none', events:[{t,label,side}], freq, negColor:true }
export const columns = (spec) => finish(_columns(spec));
function _columns(spec) {
  const W = spec.width, phone = W < 520, H = spec.height ?? (phone ? 250 : 340);
  const P = spec.data.map(([d, v]) => ({ d, v }));
  const vals = P.filter(p => p.v != null).map(p => p.v);
  const N = nice(Math.min(0, ...vals), Math.max(0, ...vals), 5);
  const dp = spec.dp ?? dpOf(N.step);
  const top = 30 + (spec.events?.length ? 6 : 0), bottom = 30, right = 4;
  const G = gutterFor(N.ticks, spec.unit, dp);
  const n = P.length, slot = (W - right - G) / n, gap = slot > 8 ? Math.max(1.5, slot * 0.22) : 1, bw = Math.max(1, slot - gap);
  const y = lin(N.lo, N.hi, H - bottom, top), cx = i => G + i * slot + slot / 2;
  let s = svgOpen(W, H, spec.title);
  s += yAxis({ ticks: N.ticks, y, x0: 0, x1: W - right, unit: spec.unit, dp });
  P.forEach((p, i) => {
    if (p.v == null) return;
    const last = i === n - 1 && spec.highlight !== 'none';
    const neg = p.v < 0 && spec.negColor !== false;
    const fill = last ? (neg ? C.comp : C.lead) : neg ? C.compTint : C.leadTint;
    const y0 = y(0), y1 = y(p.v);
    s += `<rect x="${r1(cx(i) - bw / 2)}" y="${r1(Math.min(y0, y1))}" width="${r1(bw)}" height="${r1(Math.max(.75, Math.abs(y1 - y0)))}" fill="${fill}" data-tip="${esc(tlabel(p.d, spec.freq) + ': ' + num(p.v, { dp: spec.valueDp ?? 1, suffix: spec.unit?.suffix ?? '' }))}"/>`;
  });
  s += Lh(0, W - right, y(0), C.base, 1);
  // year ticks under the columns
  const t0 = tnum(P[0].d), t1 = tnum(P.at(-1).d);
  const tt = timeTicks(t0, t1 + 0.25, W - G);
  const pos = t => { const k = P.findIndex(p => tnum(p.d) >= t - 1e-6); return k < 0 ? null : cx(k) - slot / 2; };
  for (const k of tt) { const px = pos(k.t); if (px == null) continue; s += Lv(px, H - bottom, H - bottom + 5, C.base); s += T(px + 2, H - bottom + 19, k.label, { size: 12, fill: C.muted, cls: 'tab' }); }
  // label the latest column and any events
  const L = P.at(-1);
  if (L.v != null && spec.highlight !== 'none') {
    const ly = L.v >= 0 ? y(L.v) - 7 : y(L.v) + 16;
    s += T(cx(n - 1) + bw / 2, ly, num(L.v, { dp: spec.valueDp ?? 1, suffix: spec.unit?.suffix ?? '' }), { size: 13, fill: C.ink, weight: 600, anchor: 'end', cls: 'tab halo' });
  }
  for (const e of spec.events ?? []) { // the note sits beside the column's end, set from its edge
    const i = P.findIndex(p => p.d.startsWith(e.t)); if (i < 0) continue;
    const v = P[i].v, lines = e.label.split('\n');
    const w = Math.max(...lines.map((ln, k) => tw(ln, 12, k ? 400 : 500)));
    const flip = cx(i) + bw / 2 + 6 + w > W - 2;
    const tx = flip ? cx(i) - bw / 2 - 6 : cx(i) + bw / 2 + 6;
    const ey = v < 0 ? y(v) - (lines.length - 1) * 15 + 4 : y(v) + 11;
    lines.forEach((ln, k) => { s += T(tx, ey + k * 15, ln, { size: 12, fill: k ? C.muted : C.ink, weight: k ? 400 : 500, anchor: flip ? 'end' : 'start', cls: 'halo' }); });
  }
  return s + '</svg>';
}

// ============================================================================ BARS (ranked)
// spec: { width, rows:[{name,value,highlight?}], unit, dp, ref:{value,label}, sort:true, maxRows? }
export const bars = (spec) => finish(_bars(spec));
function _bars(spec) {
  const W = spec.width, phone = W < 560;
  let rows = spec.rows.filter(r => r.value != null);
  if (spec.sort !== false) rows = rows.slice().sort((a, b) => b.value - a.value);
  const vals = rows.map(r => r.value);
  const lo = Math.min(0, ...vals), hi = Math.max(0, ...vals, spec.ref?.value ?? 0);
  const fmt = v => num(v, { dp: spec.dp ?? 1, prefix: spec.unit?.prefix ?? '', suffix: spec.unit?.suffix ?? '' });
  const valW = Math.max(...rows.map(r => tw(fmt(r.value), 12.5, 500))) + 8;
  const nameW = phone ? 0 : Math.min(200, Math.max(...rows.map(r => tw(r.name, 13, r.highlight ? 600 : 400))) + 14);
  const bh = phone ? 10 : 13, row = phone ? 36 : 25, top = spec.ref ? 54 : 34;
  const x0 = nameW + (lo < 0 ? valW : 0), x1 = W - valW;
  const x = lin(lo, hi, x0, x1);
  const H = top + rows.length * row + 8;
  let s = svgOpen(W, H, spec.title);
  // a light scale at the top: three values, no gridlines through the names
  const N = nice(lo, hi, phone ? 3 : 4);
  const bands = phone ? rows.map((_, i) => { const yy = top + i * row + 18; return [yy - 3, yy + bh + 3]; }) : null;
  // every bar carries its value, so a phone keeps only the zero line; the scale is for desktop
  if (phone) s += rowRules(x(0), 0, 0, bands, C.base);
  else for (const v of N.ticks) { if (v < lo - 1e-9 || v > hi + 1e-9) continue; s += Lv(x(v), top - 8, H - 6, v === 0 ? C.base : C.grid); s += T(x(v), top - 14, num(v, { dp: dpOf(N.step), suffix: v === N.ticks.filter(t => t <= hi).at(-1) ? spec.unit?.suffix ?? '' : '' }), { size: 12, fill: C.muted, anchor: 'middle', cls: 'tab' }); }
  if (spec.ref) { // the rule runs row by row and stops short of any value label it would strike
    const rx = x(spec.ref.value);
    s += T(rx, top - 30, spec.ref.label, { size: 12, fill: C.ink, weight: 600, anchor: 'middle' });
    s += Lv(rx, top - 24, top - 4, C.ink, 1);
    rows.forEach((r, i) => {
      const y0 = top + i * row, yy = y0 + (phone ? 18 : (row - bh) / 2);
      const end = r.value < 0 ? x(Math.min(0, r.value)) - 5 : x(Math.max(0, r.value)) + 5, w = tw(fmt(r.value), 12.5, 500);
      const [a, b] = r.value < 0 ? [end - w - 3, end + 2] : [end - 2, end + w + 3];
      const hits = rx > a && rx < b;
      if (phone) { if (!hits) s += Lv(rx, yy - 3, yy + bh + 3, C.ink, 1); }
      else if (!hits) s += Lv(rx, y0, y0 + row, C.ink, 1);
      else { s += Lv(rx, y0, yy - 1, C.ink, 1); s += Lv(rx, yy + bh + 1, y0 + row, C.ink, 1); }
    });
  }
  rows.forEach((r, i) => {
    const yy = top + i * row + (phone ? 18 : (row - bh) / 2);
    const a = x(Math.min(0, r.value)), b = x(Math.max(0, r.value));
    const above = spec.ref ? r.value > spec.ref.value : r.highlight;
    const fill = above || r.highlight ? (r.value < 0 ? C.comp : C.lead) : r.value < 0 ? C.compTint : C.leadTint;
    if (phone) s += T(x0, yy - 5, r.name, { size: 12.5, fill: C.ink, weight: r.highlight ? 600 : 400 });
    else s += T(nameW - 12, yy + bh / 2 + 4.5, r.name, { size: 13, fill: C.ink, weight: r.highlight ? 600 : 400, anchor: 'end' });
    s += `<rect x="${r1(a)}" y="${r1(yy)}" width="${r1(Math.max(1, b - a))}" height="${bh}" fill="${fill}" data-tip="${esc(r.name + ': ' + fmt(r.value))}"/>`;
    const vx = r.value < 0 ? a - 5 : b + 5;
    s += T(vx, yy + bh / 2 + 4.5, fmt(r.value), { size: 12.5, fill: r.highlight ? C.ink : C.ink2, weight: r.highlight ? 600 : 400, anchor: r.value < 0 ? 'end' : 'start', cls: 'tab halo' });
  });
  return s + '</svg>';
}

// ============================================================================ DUMBBELL
// spec: { width, rows:[{name,a,b,highlight?}], keys:{a:'Rural',b:'Urban'}, unit, dp, sortBy:'b'|'a'|'gap' }
export const dumbbell = (spec) => finish(_dumbbell(spec));
function _dumbbell(spec) {
  const W = spec.width, phone = W < 560;
  const k = spec.sortBy ?? 'b';
  const rows = spec.rows.slice().sort((p, q) => k === 'gap' ? (q.b - q.a) - (p.b - p.a) : q[k] - p[k]);
  const vals = rows.flatMap(r => [r.a, r.b]);
  const N = nice(Math.min(0, ...vals), Math.max(...vals), phone ? 3 : 5);
  const nameW = phone ? 0 : Math.min(190, Math.max(...rows.map(r => tw(r.name, 13, r.highlight ? 600 : 400))) + 14);
  rows.forEach(r => { r._lines = phone ? [r.name] : wrap(r.name, nameW - 14, 13, r.highlight ? 600 : 400, 2); });
  const row = phone ? 34 : 24, top = 52, H = top + rows.length * row + 10;
  const x = lin(N.lo, N.hi, nameW + 6, W - 40);
  const fmt = v => num(v, { dp: spec.dp ?? 1 });
  let s = svgOpen(W, H, spec.title);
  const dbands = phone ? rows.map((_, i) => { const yy = top + i * row + 22; return [yy - 7, yy + 7]; }) : null;
  for (const v of N.ticks) { s += rowRules(x(v), top - 10, H - 6, dbands, v === 0 ? C.base : C.grid); s += T(x(v), top - 16, num(v, { dp: dpOf(N.step), suffix: v === N.ticks.at(-1) ? spec.unit?.suffix ?? '' : '' }), { size: 12, fill: C.muted, anchor: v === N.lo && phone ? 'start' : 'middle', cls: 'tab' }); }
  // key: swatches above the scale
  const ka = spec.keys.a, kb = spec.keys.b;
  s += `<circle cx="${nameW + 12}" cy="12" r="4.5" fill="#fff" stroke="${C.comp}" stroke-width="2"/>` + T(nameW + 22, 16, ka, { size: 12.5, fill: C.ink2 });
  const kx = nameW + 34 + tw(ka, 12.5);
  s += `<circle cx="${kx}" cy="12" r="4.5" fill="${C.lead}"/>` + T(kx + 10, 16, kb, { size: 12.5, fill: C.ink2 });
  rows.forEach((r, i) => {
    const yy = top + i * row + (phone ? 22 : row / 2);
    if (r.highlight) s += `<rect x="0" y="${r1(yy - row / 2 + (phone ? -10 : 0))}" width="${W}" height="${row}" fill="${C.wash}"/>`;
    if (phone) s += T(x(N.lo), yy - 10, r.name, { size: 12.5, fill: C.ink, weight: r.highlight ? 600 : 400, cls: 'halo' });
    else r._lines.forEach((ln, k) => { s += T(nameW - 12, yy + 4.5 + (k - (r._lines.length - 1) / 2) * 13, ln, { size: r._lines.length > 1 ? 12 : 13, fill: C.ink, weight: r.highlight ? 600 : 400, anchor: 'end' }); });
    const xa = x(r.a), xb = x(r.b);
    const odd = spec.flagWhen ? spec.flagWhen(r) : false;
    s += `<line x1="${r1(xa)}" x2="${r1(xb)}" y1="${r1(yy)}" y2="${r1(yy)}" stroke="${odd ? C.compTint : C.ctx2}" stroke-width="${odd ? 3 : 2.5}"/>`;
    if (odd && spec.flagLabel && !phone) s += T(Math.max(xa, xb) + 10, yy + 4.5, spec.flagLabel, { size: 11.5, fill: C.comp });
    s += `<circle cx="${r1(xa)}" cy="${r1(yy)}" r="4.5" fill="#fff" stroke="${C.comp}" stroke-width="2" data-tip="${esc(r.name + ' · ' + ka + ': ' + fmt(r.a) + (spec.unit?.suffix ?? ''))}"/>`;
    s += `<circle cx="${r1(xb)}" cy="${r1(yy)}" r="4.75" fill="${C.lead}" stroke="#fff" stroke-width="1.5" data-tip="${esc(r.name + ' · ' + kb + ': ' + fmt(r.b) + (spec.unit?.suffix ?? ''))}"/>`;
    if (i === 0 || r.highlight) { // values outside the pair, never between the dots
      const [lx, rx] = xa < xb ? [xa, xb] : [xb, xa], [lv, rv] = xa < xb ? [r.a, r.b] : [r.b, r.a];
      s += T(lx - 9, yy + 4.5, fmt(lv), { size: 12, fill: C.ink2, anchor: 'end', cls: 'tab' });
      s += T(rx + 9, yy + 4.5, fmt(rv), { size: 12, fill: C.ink, weight: 600, cls: 'tab' });
    }
  });
  return s + '</svg>';
}

// ============================================================================ SMALL MULTIPLES
// spec: { width, panels:[{name,data:[[d,v]],highlight?}], unit, ref:{data:[[d,v]],label}, shared:true, cols? }
export const multiples = (spec) => finish(_multiples(spec));
function _multiples(spec) {
  const W = spec.width, cols = spec.cols ?? Math.max(2, Math.min(4, Math.floor(W / 190)));
  const gx = 24, pw = (W - gx * (cols - 1)) / cols, ph = 70, head = 52, foot = 6, gy = 22;
  const P = spec.panels;
  const vals = P.flatMap(p => p.data.map(d => d[1]).filter(v => v != null));
  // shared scale; outliers beyond the fence are clipped and said so
  const sorted = vals.slice().sort((a, b) => a - b), q = f => sorted[Math.floor(f * (sorted.length - 1))];
  const fence = q(0.75) + 3 * (q(0.75) - q(0.25));
  const hiV = Math.max(...vals.filter(v => v <= fence)), loV = Math.min(0, ...vals);
  const N = nice(loV, hiV, 3);
  const rowsN = Math.ceil(P.length / cols), H = rowsN * (head + ph + foot + 18) + (rowsN - 1) * gy;
  let s = svgOpen(W, H, spec.title);
  const t0 = tnum(P[0].data[0][0]), t1 = tnum(P[0].data.at(-1)[0]);
  const G = gutterFor(N.ticks, spec.unit, dpOf(N.step)) - 2;
  P.forEach((p, i) => {
    const c = i % cols, r = Math.floor(i / cols);
    const ox = c * (pw + gx), oy = r * (head + ph + foot + 18 + gy);
    const x = lin(t0, t1, ox + G, ox + pw - 4), y = lin(N.lo, N.hi, oy + head + ph, oy + head);
    const last = p.data.filter(d => d[1] != null).at(-1);
    const lines = wrap(p.name, pw - 52, 12.5, p.highlight ? 600 : 500, 2);
    if (spec.fy && last) { const yr = last[0].slice(0, 4); s += T(ox + pw, oy + 28, `${yr}-${String(+yr.slice(2) + 1).padStart(2, '0')}`, { size: 11, fill: C.muted, anchor: 'end' }); }
    lines.forEach((ln, k) => { s += T(ox, oy + 13 + k * 15, ln, { size: 12.5, fill: C.ink, weight: 500 }); });
    s += T(ox + pw, oy + 13, num(last[1], { dp: 1, suffix: spec.unit?.suffix ?? '' }), { size: 13, fill: C.ink, weight: 600, anchor: 'end', cls: 'tab' });
    for (const v of N.ticks) {
      s += Lh(ox + G, ox + pw, y(v), v === 0 ? C.base : C.grid, 1);
      s += T(ox, y(v) + 4, num(v, { dp: dpOf(N.step), suffix: v === N.ticks.at(-1) ? spec.unit?.suffix ?? '' : '' }), { size: 11, fill: c === 0 ? C.muted : C.faint, cls: 'tab' });
    }
    if (spec.ref) {
      let d = ''; spec.ref.data.forEach(([dd, v], k) => { if (v != null) d += `${d ? 'L' : 'M'}${r1(x(tnum(dd)))},${r1(y(Math.min(v, N.hi)))}`; });
      s += `<path d="${d}" fill="none" stroke="${C.ctx}" stroke-width="1.25" stroke-dasharray="2 2.5"/>`;
    }
    let d = '', clipped = false;
    p.data.forEach(([dd, v]) => { if (v == null) return; if (v > N.hi) clipped = true; d += `${d ? 'L' : 'M'}${r1(x(tnum(dd)))},${r1(y(Math.min(v, N.hi)))}`; });
    const col = p.highlight ? C.lead : C.ink2;
    s += `<path d="${d}" fill="none" stroke="${col}" stroke-width="${p.highlight ? 2 : 1.5}" stroke-linejoin="round" stroke-linecap="round"/>`;
    s += `<circle cx="${r1(x(tnum(last[0])))}" cy="${r1(y(Math.min(last[1], N.hi)))}" r="3" fill="${col}" stroke="#fff" stroke-width="1.5"/>`;
    if (clipped) s += T(ox + pw, oy + 28, 'off the scale ↑', { size: 11, fill: C.muted, anchor: 'end' });
    if (r === rowsN - 1 || i + cols >= P.length) {
      const lab = d => spec.fy ? `${d.slice(0, 4)}-${String(+d.slice(2, 4) + 1).padStart(2, '0')}` : tlabel(d).replace(' 20', " ’");
      s += T(ox, oy + head + ph + 17, lab(P[0].data[0][0]), { size: 11, fill: C.muted });
      s += T(ox + pw, oy + head + ph + 17, lab(P[0].data.at(-1)[0]), { size: 11, fill: C.muted, anchor: 'end' });
    }
  });
  return s + '</svg>';
}

// ============================================================================ RANGE TABLE
// Replaces the sparkline table: each row shows where the latest reading sits inside the
// row's own history, on one scale shared by every row so rows compare.
// spec: { width, rows:[{name, latest, history:[v], extra?}], unit, dp, columns:{extra:'Index'}, window:'2015–2025' }
export const rangeTable = (spec) => finish(_rangeTable(spec));
function _rangeTable(spec) {
  const W = spec.width, phone = W < 560;
  const rows = spec.rows;
  const all = rows.flatMap(r => r.history.filter(v => v != null));
  const N = nice(Math.max(Math.min(...all), spec.clamp?.[0] ?? -Infinity), Math.min(Math.max(...all), spec.clamp?.[1] ?? Infinity), phone ? 3 : 4);
  const nameW = phone ? W * 0.42 : Math.min(260, W * 0.3), extraW = spec.columns?.extra && !phone ? 82 : 0, valW = 64;
  const sx0 = nameW + extraW + valW + 18, sx1 = W - 6, rowH = 30, top = 44;
  const x = lin(N.lo, N.hi, sx0, sx1), cx = v => Math.max(sx0, Math.min(sx1, x(v)));
  const H = top + rows.length * rowH + 12;
  let s = svgOpen(W, H, spec.title);
  s += T(0, 16, 'Item', { size: 12, fill: C.muted, weight: 500 });
  if (extraW) s += T(nameW + extraW - 8, 16, spec.columns.extra, { size: 12, fill: C.muted, weight: 500, anchor: 'end' });
  s += T(nameW + extraW + valW, 16, 'Latest', { size: 12, fill: C.muted, weight: 500, anchor: 'end' });
  s += T(sx0, 16, phone ? 'Range' : `Range, ${spec.window}`, { size: 12, fill: C.muted, weight: 500 });
  for (const v of N.ticks) { s += T(x(v), 36, num(v, { dp: 0, suffix: v === N.ticks.at(-1) ? spec.unit?.suffix ?? '' : '' }), { size: 11, fill: C.muted, anchor: 'middle', cls: 'tab' }); s += Lv(x(v), top - 2, H - 8, v === 0 ? C.ctx2 : C.grid); }
  s += Lh(0, W, top - 4, C.base, 1);
  rows.forEach((r, i) => {
    const yy = top + i * rowH + rowH / 2;
    if (r.gap) { s += T(W / 2, yy + 4, r.gap, { size: 12, fill: C.muted, anchor: 'middle' }); s += Lh(0, W, top + (i + 1) * rowH - 1, C.grid); return; }
    const h = r.history.filter(v => v != null).sort((a, b) => a - b);
    const qq = f => h[Math.floor(f * (h.length - 1))];
    const name = wrap(r.name, nameW - 10, 13, 400, 1)[0];
    s += T(0, yy + 4.5, name, { size: 13, fill: C.ink });
    if (extraW) s += T(nameW + extraW - 8, yy + 4.5, num(r.extra, { dp: 1 }), { size: 13, fill: C.ink2, anchor: 'end', cls: 'tab' });
    s += T(nameW + extraW + valW, yy + 4.5, num(r.latest, { dp: 1, suffix: spec.unit?.suffix ?? '' }), { size: 13, fill: C.ink, weight: 600, anchor: 'end', cls: 'tab' });
    // the range: min–max hairline, inter-quartile bar, median tick, latest dot
    s += `<line x1="${r1(cx(h[0]))}" x2="${r1(cx(h.at(-1)))}" y1="${yy}" y2="${yy}" stroke="${C.ctx2}" stroke-width="1.5"/>`;
    s += `<rect x="${r1(cx(qq(.25)))}" y="${yy - 4}" width="${r1(Math.max(2, cx(qq(.75)) - cx(qq(.25))))}" height="8" fill="${C.ctx2}"/>`;
    s += Lv(cx(qq(.5)), yy - 6, yy + 6, C.ink2, 1.5);
    const hi = r.latest >= qq(.75), lo = r.latest <= qq(.25);
    s += `<circle cx="${r1(cx(r.latest))}" cy="${yy}" r="4.5" fill="${hi ? C.comp : lo ? C.lead : C.ink}" stroke="#fff" stroke-width="1.5" data-tip="${esc(r.name + ': latest ' + num(r.latest, { dp: 1 }) + ', median ' + num(qq(.5), { dp: 1 }) + ', range ' + num(h[0], { dp: 1 }) + ' to ' + num(h.at(-1), { dp: 1 }))}"/>`;
    if (r.latest > N.hi || h.at(-1) > N.hi) s += T(sx1, yy - 7, '→', { size: 11, fill: C.muted, anchor: 'end' });
    s += Lh(0, W, top + (i + 1) * rowH - 1, C.grid);
  });
  return s + '</svg>';
}

// ============================================================================ INDIA TILE MAP
// Every state and UT as an equal tile, roughly where it sits. Area never misleads; Goa and
// Lakshadweep get the same say as Rajasthan.
export const TILES = {
  JK: [2, 0], LA: [3, 0],
  PB: [1, 1], HP: [2, 1], UK: [3, 1], AR: [8, 1],
  CH: [1, 2], HR: [2, 2], DL: [3, 2], UP: [4, 2], BR: [5, 2], SK: [6, 2], AS: [7, 2], NL: [8, 2],
  RJ: [2, 3], MP: [3, 3], CG: [4, 3], JH: [5, 3], WB: [6, 3], ML: [7, 3], MN: [8, 3],
  DH: [1, 4], GJ: [2, 4], MH: [3, 4], TS: [4, 4], OD: [5, 4], TR: [7, 4], MZ: [8, 4],
  GA: [3, 5], KA: [4, 5], AP: [5, 5],
  LD: [2, 6], KL: [4, 6], TN: [5, 6], PY: [6, 6], AN: [8, 6],
};
// spec: { width, values:{ISO:v}, names:{ISO:name}, unit, dp, breaks?:[...], diverge?:false }
export const tileMap = (spec) => finish(_tileMap(spec));
function _tileMap(spec) {
  const W = spec.width, phone = W < 520;
  const colsN = 9, rowsN = 7, gap = 3;
  const cell = Math.min(phone ? 999 : 76, (W - gap * (colsN - 1)) / colsN);
  const legendH = 54, H = legendH + rowsN * (cell + gap);
  const vals = Object.values(spec.values).filter(v => v != null).sort((a, b) => a - b);
  const breaks = spec.breaks ?? (() => { const N = nice(vals[0], vals.at(-1), 5); return N.ticks.filter(t => t > vals[0] && t <= vals.at(-1)); })();
  const ramp = C.seq.slice(0, breaks.length + 1);
  const cls = v => { let i = 0; while (i < breaks.length && v >= breaks[i]) i++; return i; };
  let s = svgOpen(W, H, spec.title);
  // legend: stepped bar, break values set on the joins
  const lw = Math.min(W - 20, 340), sw = lw / ramp.length;
  ramp.forEach((c, i) => { s += `<rect x="${r1(i * sw)}" y="18" width="${r1(sw - 2)}" height="10" fill="${c}"/>`; });
  breaks.forEach((b, i) => { s += T((i + 1) * sw - 1, 44, num(b, { dp: spec.dp ?? 1, suffix: i === breaks.length - 1 ? spec.unit?.suffix ?? '' : '' }), { size: 11.5, fill: C.muted, anchor: 'middle', cls: 'tab' }); });
  s += T(0, 10, spec.legendLabel ?? '', { size: 12, fill: C.ink2 });
  for (const [iso, [c, r]] of Object.entries(TILES)) {
    const v = spec.values[iso], x = c * (cell + gap), y = legendH + r * (cell + gap);
    const k = v == null ? -1 : cls(v), fill = k < 0 ? '#fff' : ramp[k];
    const dark = k >= 3, txt = dark ? '#fff' : C.ink;
    s += `<rect x="${r1(x)}" y="${r1(y)}" width="${r1(cell)}" height="${r1(cell)}" fill="${fill}"${k < 0 ? ` stroke="${C.ctx2}" stroke-dasharray="2 2"` : ''} data-tip="${esc((spec.names?.[iso] ?? iso) + ': ' + (v == null ? 'no estimate' : num(v, { dp: spec.dp ?? 1, suffix: spec.unit?.suffix ?? '' })))}"/>`;
    s += T(x + 6, y + 15, iso, { size: phone ? 10.5 : 11.5, fill: txt, weight: 600 });
    if (cell > 34) s += T(x + 6, y + cell - 8, v == null ? 'n/a' : num(v, { dp: spec.dp ?? 1 }), { size: phone ? 10.5 : 12, fill: dark ? '#fff' : C.ink2, cls: 'tab' });
  }
  return s + '</svg>';
}

// ============================================================================ STACKED AREA (composition over time)
// spec: { width, years:[..], layers:[{name,data,color}], unit:{suffix:'%'}, labelMin:12 }
export const stack = (spec) => finish(_stack(spec));
function _stack(spec) {
  const W = spec.width, phone = W < 520, H = spec.height ?? (phone ? 280 : 380);
  const L = spec.layers, n = spec.years.length;
  const labW = phone ? 0 : Math.max(...L.map(l => tw(l.name, 12.5, 500))) + 92;
  const top = 12, bottom = 30;
  const t0 = +spec.years[0], t1 = +spec.years.at(-1);
  const x = lin(t0, t1, 0, W - labW - 4), y = lin(0, 100, H - bottom, top);
  const cum = spec.years.map((_, i) => { let a = 0; return L.map(l => { const lo = a; a += l.data[i] ?? 0; return [lo, a]; }); });
  let s = svgOpen(W, H, spec.title);
  L.forEach((l, j) => {
    let up = '', dn = '';
    for (let i = 0; i < n; i++) up += `${i ? 'L' : 'M'}${r1(x(+spec.years[i]))},${r1(y(cum[i][j][1]))}`;
    for (let i = n - 1; i >= 0; i--) dn += `L${r1(x(+spec.years[i]))},${r1(y(cum[i][j][0]))}`;
    s += `<path d="${up}${dn}Z" fill="${l.color}" stroke="#fff" stroke-width="1" data-tip="${esc(l.name + ', ' + spec.years.at(-1) + ': ' + num(l.data.at(-1), { dp: 1, suffix: '%' }))}"/>`;
  });
  for (const v of [0, 25, 50, 75, 100]) { s += Lh(0, x(t1), y(v), v === 0 ? C.base : 'rgba(255,255,255,.55)', 1); }
  for (const v of [25, 50, 75, 100]) s += T(4, y(v) + 14, v + (v === 100 ? '%' : ''), { size: 11.5, fill: '#fff', cls: 'tab' });
  s += xTimeAxis({ ticks: timeTicks(t0, t1, W - labW), x, y: H - bottom, lo: 0, hi: x(t1) });
  // labels at the right edge, with leaders when a layer is thin
  const items = L.map((l, j) => { const [a, b] = cum[n - 1][j]; return { l, mid: y((a + b) / 2), v: l.data.at(-1), y: y((a + b) / 2) - 7, h: 16 }; });
  if (phone) { // a two-column key under the plot, top layer first
    const keyRows = Math.ceil(L.length / 2), kh = 20, colW = W / 2;
    const out = s.replace(`height="${H}" viewBox="0 0 ${W} ${H}"`, `height="${H + 12 + keyRows * kh}" viewBox="0 0 ${W} ${H + 12 + keyRows * kh}"`);
    let k = '';
    L.slice().reverse().forEach((l, i) => { const cx = (i % 2) * colW, cy = H + 14 + Math.floor(i / 2) * kh;
      k += `<rect x="${cx}" y="${cy}" width="9" height="9" fill="${l.color}"/>` + T(cx + 14, cy + 9, l.name, { size: 12, fill: C.ink }) + T(cx + colW - 10, cy + 9, num(l.data.at(-1), { dp: 1, suffix: '%' }), { size: 12, fill: C.ink2, anchor: 'end', cls: 'tab' }); });
    return out + k + '</svg>';
  }
  for (const p of settle(items, 16, top, H - bottom)) {
    const lx = x(t1) + 18;
    s += `<path d="M${r1(x(t1) + 2)},${r1(p.mid)}L${r1(lx - 4)},${r1(p.y + 7)}" stroke="${C.faint}" fill="none"/>`;
    s += `<rect x="${r1(lx)}" y="${r1(p.y + 2)}" width="9" height="9" fill="${p.l.color}"/>`;
    s += T(lx + 14, p.y + 11, p.l.name, { size: 12.5, fill: C.ink, weight: 500 });
    s += T(W - 4, p.y + 11, num(p.v, { dp: 1, suffix: '%' }), { size: 12.5, fill: C.ink2, anchor: 'end', cls: 'tab' });
  }
  return s + '</svg>';
}

// ============================================================================ ARROWS (change between two dates)
// Each row is an arrow from where a measure stood to where it stands now, ranked by now.
// Rising rows in sindoor, falling in indigo; the arrowhead is the latest value.
// spec: { width, rows:[{name, from, to}], from:'January', to:'August', unit, ref:{value,label}, top? }
export const arrows = (spec) => finish(_arrows(spec));
function _arrows(spec) {
  const W = spec.width, phone = W < 560;
  const rows = spec.rows.slice().sort((a, b) => b.to - a.to);
  const vals = rows.flatMap(r => [r.from, r.to]).concat(spec.ref ? [spec.ref.value] : []);
  const sorted = vals.slice().sort((a, b) => a - b), fence = sorted[Math.floor(.75 * sorted.length)] * 3 + 2;
  const N = nice(Math.min(0, ...vals), Math.min(Math.max(...vals), fence), phone ? 3 : 5);
  const nameW = phone ? 0 : Math.min(250, Math.max(...rows.map(r => tw(r.name, 12.5))) + 14);
  rows.forEach(r => { r._lines = phone ? [r.name] : wrap(r.name, nameW - 14, 12.5, 400, 2); });
  const row = phone ? 36 : 23, top = phone ? 74 : 56, H = top + rows.length * row + 8;
  const x0 = nameW + (phone ? 14 : 6), x1 = W - 54, x = lin(N.lo, N.hi, x0, x1), cx = v => Math.max(x0, Math.min(x1, x(v)));
  const fmt = v => num(v, { dp: 1 });
  let s = svgOpen(W, H, spec.title);
  const abands = phone ? rows.map((_, i) => { const yy = top + i * row + 22; return [yy - 7, yy + 7]; }) : null;
  for (const v of N.ticks) { s += rowRules(x(v), top - 10, H - 4, abands, v === 0 ? C.base : C.grid); s += T(Math.max(x(v), x0 + 8), top - 16, num(v, { dp: dpOf(N.step), suffix: v === N.ticks.at(-1) ? spec.unit?.suffix ?? '' : '' }), { size: 12, fill: C.muted, anchor: 'middle', cls: 'tab' }); }
  // key
  const k1 = `${spec.from} → ${spec.to}:`, kx = x0;
  s += T(kx, 14, k1, { size: 12, fill: C.ink2 });
  let kk = kx + tw(k1, 12) + 10;
  for (const [lab, col] of [['rising', C.comp], ['easing', C.lead]]) { s += `<path d="M${kk},10H${kk + 18}" stroke="${col}" stroke-width="2"/><path d="M${kk + 18},6L${kk + 24},10L${kk + 18},14Z" fill="${col}"/>`; s += T(kk + 30, 14, lab, { size: 12, fill: C.ink2 }); kk += 38 + tw(lab, 12) + 12; }
  if (spec.ref) { const rx = x(spec.ref.value); s += rowRules(rx, top - 6, H - 4, abands, C.ink, 1, ' stroke-dasharray="1 3" stroke-linecap="round"'); s += T(rx + 4, top - (phone ? 36 : 30), spec.ref.label, { size: 12, fill: C.ink, weight: 600 }); }
  rows.forEach((r, i) => {
    const yy = top + i * row + (phone ? 22 : row / 2);
    if (phone) s += T(4, yy - 11, wrap(r.name, W - 12, 12.5, 400, 1)[0], { size: 12.5, fill: C.ink, cls: 'halo' });
    else r._lines.forEach((ln, k) => { s += T(nameW - 12, yy + 4.5 + (k - (r._lines.length - 1) / 2) * 12.5, ln, { size: r._lines.length > 1 ? 11.5 : 12.5, fill: C.ink, anchor: 'end' }); });
    const a = cx(r.from), b = cx(r.to), up = r.to >= r.from, col = up ? C.comp : C.lead, dir = up ? 1 : -1;
    const len = Math.abs(b - a);
    if (x(r.to) > x1 && x(r.from) > x1) {} else if (len > 7) s += `<path d="M${r1(a)},${r1(yy)}H${r1(b - dir * 6)}" stroke="${col}" stroke-width="2" stroke-linecap="round"/><path d="M${r1(b - dir * 7)},${r1(yy - 4.5)}L${r1(b)},${r1(yy)}L${r1(b - dir * 7)},${r1(yy + 4.5)}Z" fill="${col}" data-tip="${esc(r.name + ': ' + fmt(r.from) + ' → ' + fmt(r.to) + (spec.unit?.suffix ?? ''))}"/>`;
    else s += `<circle cx="${r1(b)}" cy="${r1(yy)}" r="3.5" fill="${C.ink2}" data-tip="${esc(r.name + ': ' + fmt(r.from) + ' → ' + fmt(r.to) + (spec.unit?.suffix ?? ''))}"/>`;
    if (x(r.to) > x1 && x(r.from) > x1) { s += `<path d="M${r1(x1 - 8)},${r1(yy - 5)}L${r1(x1 - 2)},${r1(yy)}L${r1(x1 - 8)},${r1(yy + 5)}" fill="none" stroke="${C.ink2}" stroke-width="1.5"/>`; s += T(x1 + 6, yy + 4, fmt(r.to), { size: 12, fill: C.ink, weight: 500, cls: 'tab' }); s += T(x1 - 14, yy + 4, `off the scale, from ${fmt(r.from)}`, { size: 11, fill: C.muted, anchor: 'end' }); return; }
    const right = up || len <= 7;
    s += T(right ? b + 8 : b - 8, yy + 4, fmt(r.to), { size: 12, fill: C.ink, weight: 500, anchor: right ? 'start' : 'end', cls: 'tab halo' });
  });
  return s + '</svg>';
}

// ============================================================================ SHARE (composition over time)
// The layers the story is about stack up from zero in colour; everything else is one quiet
// field above them, and a firm line traces the boundary between the two.
// spec: { width, years, layers:[{name,data,color}] (bottom→top), rest:{name}, boundary:{name} }
export const share = (spec) => finish(_share(spec));
function _share(spec) {
  const W = spec.width, phone = W < 520, H = spec.height ?? (phone ? 260 : 360);
  const L = spec.layers, n = spec.years.length;
  const cum = spec.years.map((_, i) => { let a = 0; return L.map(l => { const lo = a; a += l.data[i] ?? 0; return [lo, a]; }); });
  const tot = cum.map(c => c.at(-1)[1]);
  const fmt = v => num(v, { dp: 1, suffix: '%' });
  const N = nice(0, Math.max(...tot) * 1.12, phone ? 3 : 4), G = gutterFor(N.ticks, { suffix: '%' }, 0);
  const items = L.map((l, j) => ({ name: l.name, color: l.color, v: l.data.at(-1), mid: (cum[n - 1][j][0] + cum[n - 1][j][1]) / 2 }));
  const nameW = Math.max(...items.map(i => tw(i.name, 12.5, 500)), tw(spec.boundary.name, 12.5, 600));
  const labW = phone ? 0 : nameW + 16 + 14 + 18 + 48;
  const top = 18, bottom = 30, t0 = +spec.years[0], t1 = +spec.years.at(-1);
  const x = lin(t0, t1, G, W - labW - (phone ? 0 : 8)), y = lin(N.lo, N.hi, H - bottom, top);
  const area = (lo, hi) => { let u = '', d = ''; for (let i = 0; i < n; i++) u += `${i ? 'L' : 'M'}${r1(x(+spec.years[i]))},${r1(y(hi(i)))}`; for (let i = n - 1; i >= 0; i--) d += `L${r1(x(+spec.years[i]))},${r1(y(lo(i)))}`; return u + d + 'Z'; };
  let s = svgOpen(W, H, spec.title);
  s += yAxis({ ticks: N.ticks, y, x0: 0, x1: x(t1), unit: { suffix: '%' }, dp: 0 });
  L.forEach((l, j) => { s += `<path d="${area(i => cum[i][j][0], i => cum[i][j][1])}" fill="${l.color}" data-tip="${esc(l.name + ', ' + spec.years.at(-1) + ': ' + fmt(l.data.at(-1)))}"/>`; });
  L.forEach((l, j) => { let d = ''; for (let i = 0; i < n; i++) d += `${i ? 'L' : 'M'}${r1(x(+spec.years[i]))},${r1(y(cum[i][j][1]))}`; s += `<path d="${d}" fill="none" stroke="#fff" stroke-width="1"/>`; });
  s += Lh(G, x(t1), y(0), C.base, 1);
  let bd = ''; for (let i = 0; i < n; i++) bd += `${i ? 'L' : 'M'}${r1(x(+spec.years[i]))},${r1(y(tot[i]))}`;
  s += `<path d="${bd}" fill="none" stroke="${C.ink}" stroke-width="1.75" stroke-linejoin="round"/>`;
  s += `<circle cx="${r1(x(t1))}" cy="${r1(y(tot.at(-1)))}" r="3.5" fill="${C.ink}" stroke="#fff" stroke-width="1.5"/>`;
  if (spec.rest) s += T(G + 8, top + 14, phone ? spec.restShort ?? spec.rest : spec.rest, { size: 12, fill: C.muted, cls: 'halo' });
  s += xTimeAxis({ ticks: timeTicks(t0, t1, x(t1) - G), x, y: H - bottom, lo: G - 10, hi: x(t1) + 10 });
  if (phone) {
    const kh = 20, colW = W / 2, list = [{ name: spec.boundary.name, color: null, v: tot.at(-1) }, ...items.slice().reverse()], rowsK = Math.ceil(list.length / 2);
    const k = list.map((it, i) => { const cx = (i % 2) * colW, cy = H + 14 + Math.floor(i / 2) * kh;
      return (it.color ? `<rect x="${cx}" y="${cy}" width="9" height="9" fill="${it.color}"/>` : `<line x1="${cx}" x2="${cx + 10}" y1="${cy + 5}" y2="${cy + 5}" stroke="${C.ink}" stroke-width="2"/>`) + T(cx + 15, cy + 9, it.name, { size: 12, fill: C.ink, weight: it.color ? 400 : 600 }) + T(cx + colW - 10, cy + 9, fmt(it.v), { size: 12, fill: C.ink2, anchor: 'end', cls: 'tab', weight: it.color ? 400 : 600 }); }).join('');
    const H2 = H + 18 + rowsK * kh;
    return s.replace(`height="${H}" viewBox="0 0 ${W} ${H}"`, `height="${H2}" viewBox="0 0 ${W} ${H2}"`) + k + '</svg>';
  }
  const lx = x(t1) + 16, vx = W;
  const list = [{ name: spec.boundary.name, v: tot.at(-1), anchorY: y(tot.at(-1)), y: y(tot.at(-1)) - 8, h: 22, lead: true },
    ...items.map(it => ({ ...it, anchorY: y(it.mid), y: y(it.mid) - 7, h: 17 }))];
  for (const p of settle(list, 17, top - 6, H - bottom)) {
    s += `<path d="M${r1(x(t1) + (p.lead ? 5 : 1))},${r1(p.anchorY)}L${r1(lx - 4)},${r1(p.y + 8)}" stroke="${p.lead ? C.ink : C.faint}" fill="none"/>`;
    if (!p.lead) s += `<rect x="${r1(lx)}" y="${r1(p.y + 3)}" width="9" height="9" fill="${p.color}"/>`;
    s += T(p.lead ? lx : lx + 14, p.y + 12, p.name, { size: 12.5, fill: C.ink, weight: p.lead ? 600 : 400 });
    s += T(vx, p.y + 12, fmt(p.v), { size: 12.5, fill: p.lead ? C.ink : C.ink2, weight: p.lead ? 600 : 400, anchor: 'end', cls: 'tab' });
  }
  return s + '</svg>';
}

// ============================================================================ WATERFALL
// Parts that add up to a total, each bar starting where the last ended. Inflows indigo,
// outflows sindoor, the total in ink. spec: { width, rows:[[name,v]], total:[name,v], unit, fmt }
export const waterfall = (spec) => finish(_waterfall(spec));
function _waterfall(spec) {
  const W = spec.width, phone = W < 560, H = spec.height ?? (phone ? 300 : 340);
  const steps = []; let run = 0;
  for (const [name, v] of spec.rows) { steps.push({ name, v, a: run, b: run + v }); run += v; }
  steps.push({ name: spec.total[0], v: spec.total[1], a: 0, b: spec.total[1], total: true });
  const ext = steps.flatMap(s => [s.a, s.b]);
  const N = nice(Math.min(0, ...ext), Math.max(0, ...ext), 5), dp = dpOf(N.step);
  const fmt = (phone && spec.fmtShort) || spec.fmt || (v => num(v, { dp: 1, sign: true }));
  const G = gutterFor(N.ticks, spec.unit, dp), top = 34, bottom = phone ? 44 : 36;
  const slot = (W - G) / steps.length, bw = Math.min(64, slot * 0.56);
  const y = lin(N.lo, N.hi, H - bottom, top), cx = i => G + slot * i + slot / 2;
  let s = svgOpen(W, H, spec.title);
  s += yAxis({ ticks: N.ticks, y, x0: 0, x1: W, unit: spec.unit, dp });
  steps.forEach((st, i) => {
    const fill = st.total ? C.ink : st.v >= 0 ? C.lead : C.comp;
    const y0 = y(Math.max(st.a, st.b)), y1 = y(Math.min(st.a, st.b));
    s += `<rect x="${r1(cx(i) - bw / 2)}" y="${r1(y0)}" width="${r1(bw)}" height="${r1(Math.max(1, y1 - y0))}" fill="${fill}" data-tip="${esc(st.name + ': ' + fmt(st.v))}"/>`;
    if (i < steps.length - 1) { const yy = y(st.b); s += `<line x1="${r1(cx(i) + bw / 2)}" x2="${r1(cx(i + 1) - bw / 2)}" y1="${r1(yy)}" y2="${r1(yy)}" stroke="${C.faint}" stroke-dasharray="2 2"/>`; }
    const up = st.total ? st.v >= 0 : st.v >= 0, ly = up ? y0 - 7 : y1 + 16;
    s += T(cx(i), ly, fmt(st.v), { size: phone ? 11.5 : 12.5, fill: C.ink, weight: st.total ? 600 : 500, anchor: 'middle', cls: 'tab halo' });
    const nm = wrap(st.name, slot - 6, 12, st.total ? 600 : 400, 2);
    nm.forEach((ln, k) => { s += T(cx(i), H - bottom + 18 + k * 14, ln, { size: 12, fill: C.ink, weight: st.total ? 600 : 400, anchor: 'middle' }); });
  });
  s += Lh(G, W, y(0), C.base, 1);
  return s + '</svg>';
}

// ============================================================================ PYRAMID
// Age and sex. Bars for the year in view; an outline for a comparison year, as shares of the
// population so different totals compare. spec: { width, groups, male, female, year, ghost:{male,female,year} }
export const pyramid = (spec) => finish(_pyramid(spec));
function _pyramid(spec) {
  const W = spec.width, phone = W < 560;
  const totNow = [...spec.male, ...spec.female].reduce((a, b) => a + (b ?? 0), 0);
  const totG = spec.ghost ? [...spec.ghost.male, ...spec.ghost.female].reduce((a, b) => a + (b ?? 0), 0) : 1;
  const sh = (v, t) => v == null ? null : v / t * 100;
  const rows = spec.groups.map((g, i) => ({ g, m: sh(spec.male[i], totNow), f: sh(spec.female[i], totNow), gm: spec.ghost ? sh(spec.ghost.male[i], totG) : null, gf: spec.ghost ? sh(spec.ghost.female[i], totG) : null })).reverse();
  const max = Math.max(...rows.flatMap(r => [r.m, r.f, r.gm, r.gf]).filter(v => v != null));
  const N = nice(0, max, phone ? 2 : 4), mid = W / 2, gap = phone ? 40 : 52, half = mid - gap / 2 - 18;
  const row = phone ? 14 : 16, bh = row - 3, top = 52, H = top + rows.length * row + 28;
  const xr = lin(0, N.hi, 0, half);
  let s = svgOpen(W, H, spec.title);
  s += T(mid - gap / 2 - 4, 14, 'Men', { size: 12.5, fill: C.ink, weight: 600, anchor: 'end' });
  s += T(mid + gap / 2 + 4, 14, 'Women', { size: 12.5, fill: C.ink, weight: 600 });
  if (spec.ghost) { const k1 = `Bars ${spec.year}`, k2 = `Outline ${spec.ghost.year}`, kw = tw(k1, 12) + tw(k2, 12) + 60, kx = mid - kw / 2;
    s += `<rect x="${r1(kx)}" y="24" width="12" height="9" fill="${C.leadTint}"/>` + T(kx + 17, 33, k1, { size: 12, fill: C.ink2 });
    const k2x = kx + 17 + tw(k1, 12) + 16; s += `<path d="M${r1(k2x)},33V24H${r1(k2x + 12)}" fill="none" stroke="${C.ink}" stroke-width="1.25"/>` + T(k2x + 17, 33, k2, { size: 12, fill: C.ink2 }); }
  for (const v of N.ticks) { if (!v) continue; for (const sgn of [-1, 1]) { const xx = sgn < 0 ? mid - gap / 2 - xr(v) : mid + gap / 2 + xr(v); s += Lv(xx, top - 4, H - 24, C.grid); s += T(xx, H - 8, num(v, { dp: dpOf(N.step), suffix: '%' }), { size: 11, fill: C.muted, anchor: 'middle', cls: 'tab' }); } }
  rows.forEach((r, i) => {
    const yy = top + i * row;
    if (r.m != null) s += `<rect x="${r1(mid - gap / 2 - xr(r.m))}" y="${yy}" width="${r1(xr(r.m))}" height="${bh}" fill="${C.leadTint}" data-tip="${esc(`Men ${r.g}: ${num(r.m, { dp: 1 })}% of the population`)}"/>`;
    if (r.f != null) s += `<rect x="${r1(mid + gap / 2)}" y="${yy}" width="${r1(xr(r.f))}" height="${bh}" fill="${C.compTint}" data-tip="${esc(`Women ${r.g}: ${num(r.f, { dp: 1 })}% of the population`)}"/>`;
    s += T(mid, yy + bh - 2, r.g === '100' ? '100+' : r.g, { size: phone ? 10.5 : 11, fill: C.ink2, anchor: 'middle', cls: 'tab' });
  });
  if (spec.ghost) { // the comparison year as a stepped outline on each side
    for (const side of ['m', 'f']) {
      let d = '';
      rows.forEach((r, i) => { const v = side === 'm' ? r.gm : r.gf; if (v == null) return; const xx = side === 'm' ? mid - gap / 2 - xr(v) : mid + gap / 2 + xr(v); const yy = top + i * row; d += `${d ? 'L' : 'M'}${r1(xx)},${yy}L${r1(xx)},${yy + row}`; });
      s += `<path d="${d}" fill="none" stroke="${C.ink}" stroke-width="1.25"/>`;
    }
  }
  return s + '</svg>';
}

// ============================================================================ SCATTER
// Two measures for one set of units. Labels only for the points the eye goes to; medians as
// quiet crosshairs. spec: { width, points:[{name,x,y,highlight?}], xUnit, yUnit, xLabel, yLabel, label:[names] }
export const scatter = (spec) => finish(_scatter(spec));
function _scatter(spec) {
  const W = spec.width, phone = W < 560, H = spec.height ?? (phone ? 340 : 440);
  const P = spec.points;
  const NX = nice(Math.min(...P.map(p => p.x)) * (spec.xZero ? 0 : 1), Math.max(...P.map(p => p.x)), phone ? 3 : 5);
  const NY = nice(Math.min(0, ...P.map(p => p.y)), Math.max(...P.map(p => p.y)), 5);
  const G = gutterFor(NY.ticks, spec.yUnit, dpOf(NY.step)), top = 30, bottom = 46, right = 12;
  const x = lin(NX.lo, NX.hi, G, W - right), y = lin(NY.lo, NY.hi, H - bottom, top);
  let s = svgOpen(W, H, spec.title);
  s += yAxis({ ticks: NY.ticks, y, x0: 0, x1: W - right, unit: spec.yUnit, dp: dpOf(NY.step) });
  for (const v of NX.ticks) { s += Lv(x(v), H - bottom, H - bottom + 5, C.base); s += T(x(v), H - bottom + 19, spec.xFmt ? spec.xFmt(v) : num(v, { dp: dpOf(NX.step) }), { size: 12, fill: C.muted, anchor: 'middle', cls: 'tab' }); }
  s += T(W - right, H - 6, spec.xLabel + ' →', { size: 12, fill: C.ink2, anchor: 'end' });
  s += T(G, top - 14, '↑ ' + spec.yLabel, { size: 12, fill: C.ink2 });
  const med = a => { const b = a.slice().sort((p, q) => p - q); return b[Math.floor(b.length / 2)]; };
  const mx = med(P.map(p => p.x)), my = med(P.map(p => p.y));
  s += Lv(x(mx), top, H - bottom, C.ctx2, 1, '2 3') + Lh(G, W - right, y(my), C.ctx2, 1).replace('/>', ' stroke-dasharray="2 3"/>');
  s += T(x(mx) + 4, H - bottom - 6, 'median', { size: 11, fill: C.muted, cls: 'halo' }) + T(W - right, y(my) - 5, 'median', { size: 11, fill: C.muted, anchor: 'end', cls: 'halo' });
  for (const p of P) s += `<circle cx="${r1(x(p.x))}" cy="${r1(y(p.y))}" r="${p.highlight ? 5.5 : 4.75}" fill="${C.lead}" fill-opacity="${p.highlight ? 1 : 0.62}" stroke="#fff" stroke-width="1.5" data-tip="${esc(p.name + ': ' + (spec.xFmt ? spec.xFmt(p.x) : num(p.x)) + ', ' + num(p.y, { dp: 1, suffix: spec.yUnit?.suffix ?? '' }))}"/>`;
  // labels: chosen points, placed to the side with more room, nudged apart
  const want = P.filter(p => (spec.label ?? []).includes(p.name) || p.highlight);
  // each label tries eight spots around its dot and takes the one furthest from every other
  // dot and every placed label; a leader is drawn when it had to move off the dot's side
  const dots = P.map(p => ({ x: x(p.x), y: y(p.y), r: 6 })), placed = [];
  const gap = (b) => { let c = 99;
    for (const d of dots) { const nx = Math.max(b.x0, Math.min(d.x, b.x1)), ny = Math.max(b.y0, Math.min(d.y, b.y1)); c = Math.min(c, Math.hypot(nx - d.x, ny - d.y) - d.r); }
    for (const q of placed) c = Math.min(c, Math.max(q.x0 - b.x1, b.x0 - q.x1, q.y0 - b.y1, b.y0 - q.y1));
    if (b.x0 < 0 || b.x1 > W - right + 4 || b.y0 < top - 16 || b.y1 > H - bottom) c = -99;
    return c; };
  for (const p of want) {
    const px = x(p.x), py = y(p.y), t = p.short ?? p.name, w = tw(t, 12, 500);
    const own = dots.find(d => d.x === px && d.y === py); if (own) own.r = 0;
    const C8 = [[8, 4, 'start'], [-8, 4, 'end'], [8, -8, 'start'], [-8, -8, 'end'], [8, 16, 'start'], [-8, 16, 'end'], [0, -11, 'middle'], [0, 21, 'middle'], [14, -20, 'start'], [-14, -20, 'end'], [14, 28, 'start'], [-14, 28, 'end']];
    let best = null;
    for (const [dx, dy, an] of C8) { const lx = px + dx, ly = py + dy, x0 = an === 'start' ? lx : an === 'end' ? lx - w : lx - w / 2;
      const b = { x0: x0 - 2, x1: x0 + w + 2, y0: ly - 10, y1: ly + 3 }, c = gap(b); if (!best || c > best.c + 0.5) best = { c, lx, ly, an, b }; if (c >= 3) break; } // the first clear spot in order of preference
    if (own) own.r = 6;
    placed.push(best.b);
    if (Math.abs(best.ly - py) > 18) s += `<line x1="${r1(px)}" x2="${r1(px)}" y1="${r1(py + (best.ly < py ? -6 : 6))}" y2="${r1(best.ly < py ? best.ly + 4 : best.ly - 11)}" stroke="${C.faint}"/>`;
    s += T(best.lx, best.ly, t, { size: 12, fill: C.ink, weight: 500, anchor: best.an, cls: 'halo' });
  }
  return s + '</svg>';
}

// ============================================================================ HEATMAP
// A grid of cells coloured by value: months across, years down, or states by indicator.
// Diverging around a midpoint when given one. spec: { width, rows:[{name, cells:[v]}], cols:[labels], mid?, unit, dp }
export const heatmap = (spec) => finish(_heatmap(spec));
function _heatmap(spec) {
  const W = spec.width, phone = W < 560;
  const nameW = Math.max(...spec.rows.map(r => tw(r.name, 12))) + 12;
  const cw = (W - nameW) / spec.cols.length, ch = Math.max(16, Math.min(26, cw * 0.7)), top = 52;
  const H = top + spec.rows.length * (ch + 2) + 6;
  const vals = spec.rows.flatMap(r => r.cells).filter(v => v != null);
  const lo = Math.min(...vals), hi = Math.max(...vals), mid = spec.mid;
  const DIV = ['#B4472E', '#DE8C74', '#F2CFC2', '#F4F5F6', '#C7D0F0', '#7F93DE', '#2E4BC4'];
  const fillOf = v => {
    if (v == null) return null;
    if (mid == null) { const k = Math.min(C.seq.length - 1, Math.floor((v - lo) / ((hi - lo) || 1) * C.seq.length)); return C.seq[k]; }
    const span = Math.max(hi - mid, mid - lo) || 1, t = (v - mid) / span; // -1..1, warm above the midpoint
    const k = Math.round(3 - t * 3); return DIV[Math.max(0, Math.min(6, k))];
  };
  let s = svgOpen(W, H, spec.title);
  if (spec.legend) { const [l0, l1] = spec.legend, ramp = mid != null ? DIV.slice().reverse() : C.seq; s += T(0, 14, l0, { size: 12, fill: C.ink2 }); const lx = tw(l0, 12) + 10;
    ramp.forEach((c, i) => { s += `<rect x="${r1(lx + i * 22)}" y="5" width="21" height="11" fill="${c}"/>`; }); s += T(lx + ramp.length * 22 + 8, 14, l1, { size: 12, fill: C.ink2 }); }
  spec.cols.forEach((c, j) => { if (phone && j % 2) return; s += T(nameW + j * cw + cw / 2, top - 8, c, { size: 11, fill: C.muted, anchor: 'middle' }); });
  spec.rows.forEach((r, i) => {
    const yy = top + i * (ch + 2);
    s += T(nameW - 10, yy + ch / 2 + 4, r.name, { size: 12, fill: C.ink, anchor: 'end', cls: 'tab' });
    r.cells.forEach((v, j) => { const f = fillOf(v); if (!f) return; s += `<rect x="${r1(nameW + j * cw + 1)}" y="${r1(yy)}" width="${r1(cw - 2)}" height="${r1(ch)}" fill="${f}" data-tip="${esc(r.name + ' ' + spec.cols[j] + ': ' + num(v, { dp: spec.dp ?? 1, suffix: spec.unit?.suffix ?? '' }))}"/>`;
      if (!phone && cw > 34 && spec.values !== false) { const dark = f === DIV[0] || f === DIV[6] || f === C.seq[4] || f === C.seq[5]; s += T(nameW + j * cw + cw / 2, yy + ch / 2 + 4, num(v, { dp: spec.dp ?? 1 }), { size: 10.5, fill: dark ? '#fff' : C.ink2, anchor: 'middle', cls: 'tab' }); } });
  });
  return s + '</svg>';
}

// ============================================================================ SLOPE
// Two moments, one line per unit. Labels both ends, collisions settled; the steepest risers
// in indigo. spec: { width, rows:[{name,a,b,highlight?}], left, right, fmt }
export const slope = (spec) => finish(_slope(spec));
function _slope(spec) {
  const W = spec.width, phone = W < 560, H = spec.height ?? (phone ? 520 : 560);
  const fmt = spec.fmt ?? (v => num(v, { dp: 0 }));
  const vals = spec.rows.flatMap(r => [r.a, r.b]);
  const lo = Math.min(...vals), hi = Math.max(...vals), top = 40, bottom = 16;
  const y = lin(lo, hi, H - bottom, top);
  const lw = Math.max(...spec.rows.map(r => tw(fmt(r.a), 12))) + 14;
  const rw = Math.max(...spec.rows.map(r => tw(fmt(r.b) + '  ' + r.name, 12))) + 12;
  const xa = lw, xb = W - Math.min(rw, W * (phone ? 0.5 : 0.4));
  let s = svgOpen(W, H, spec.title);
  s += T(xa, 16, spec.left, { size: 12.5, fill: C.ink, weight: 600, anchor: 'middle' }) + T(xb, 16, spec.right, { size: 12.5, fill: C.ink, weight: 600, anchor: 'middle' });
  s += Lv(xa, top - 12, H - bottom + 4, C.base) + Lv(xb, top - 12, H - bottom + 4, C.base);
  const order = spec.rows.slice().sort((p, q) => (p.highlight ? 1 : 0) - (q.highlight ? 1 : 0));
  for (const r of order) s += `<line x1="${xa}" x2="${xb}" y1="${r1(y(r.a))}" y2="${r1(y(r.b))}" stroke="${r.highlight ? C.lead : C.ctx2}" stroke-width="${r.highlight ? 2 : 1.25}"/><circle cx="${xa}" cy="${r1(y(r.a))}" r="3" fill="${r.highlight ? C.lead : C.ctx}"/><circle cx="${xb}" cy="${r1(y(r.b))}" r="3.25" fill="${r.highlight ? C.lead : C.ctx}" data-tip="${esc(r.name + ': ' + fmt(r.a) + ' → ' + fmt(r.b))}"/>`;
  const L = settle(spec.rows.map(r => ({ r, y: y(r.a) - 6, h: 13 })), 13, top - 8, H), R = settle(spec.rows.map(r => ({ r, y: y(r.b) - 6, h: 13 })), 13, top - 8, H);
  for (const p of settle(spec.rows.filter(r => r.highlight).map(r => ({ r, y: y(r.a) - 6, h: 13 })), 13, top - 8, H)) s += T(xa - 8, p.y + 10, fmt(p.r.a), { size: 12, fill: C.ink, weight: 600, anchor: 'end', cls: 'tab' });
  for (const p of R) s += T(xb + 8, p.y + 10, wrap(`${fmt(p.r.b)}  ${p.r.name}`, W - xb - 10, 12, p.r.highlight ? 600 : 400, 1)[0], { size: 12, fill: p.r.highlight ? C.ink : C.ink2, weight: p.r.highlight ? 600 : 400, cls: 'tab' });
  return s + '</svg>';
}

// ============================================================================ STRIP (a distribution)
// Every unit as a dot on one axis, stacked where they crowd (a beeswarm), so the shape of the
// spread shows and the extremes can be named. spec: { width, values:[{name,v}], unit, label:[names], ref }
export const strip = (spec) => finish(_strip(spec));
function _strip(spec) {
  const W = spec.width, phone = W < 560, r = phone ? 1.9 : 3, d = r * 2 + (phone ? 0.7 : 1);
  const V = spec.values.filter(p => p.v != null).slice().sort((a, b) => a.v - b.v);
  const lo = spec.clamp ? Math.max(spec.clamp[0], V[0].v) : V[0].v, hi = spec.clamp ? Math.min(spec.clamp[1], V.at(-1).v) : V.at(-1).v;
  let N = nice(lo, hi, phone ? 4 : 6);
  if (spec.clamp) { const st = nice(spec.clamp[0], spec.clamp[1], phone ? 4 : 6).step; N = { lo: spec.clamp[0], hi: spec.clamp[1], step: st, ticks: nice(spec.clamp[0], spec.clamp[1], phone ? 4 : 6).ticks.filter(t => t >= spec.clamp[0] && t <= spec.clamp[1]) }; }
  const x = lin(N.lo, N.hi, 8, W - 8);
  const bins = new Map(); // one column of dots per bin, one dot wide
  for (const p of V) { const b = Math.round((x(Math.max(N.lo, Math.min(N.hi, p.v))) - 8) / d); (bins.get(b) ?? bins.set(b, []).get(b)).push(p); }
  const tall = Math.max(...[...bins.values()].map(a => a.length)), base = 36 + tall * d, H = base + 34;
  let s = svgOpen(W, H, spec.title);
  for (const v of N.ticks) { s += Lv(x(v), 30, base + 4, v === 0 ? C.base : C.grid); s += T(x(v), base + 22, num(v, { dp: dpOf(N.step), suffix: v === N.ticks.at(-1) ? spec.unit?.suffix ?? '' : '' }), { size: 12, fill: C.muted, anchor: 'middle', cls: 'tab' }); }
  s += Lh(8, W - 8, base + 3, C.base);
  const named = new Set(spec.label ?? []), notes = [];
  for (const [b, arr] of bins) arr.forEach((p, k) => {
    const cx = 8 + b * d, cy = base - r - k * d, hot = named.has(p.name);
    s += `<circle cx="${r1(cx)}" cy="${r1(cy)}" r="${r}" fill="${hot ? C.ink : p.v >= (spec.ref?.value ?? Infinity) ? C.comp : C.lead}" fill-opacity="${hot ? 1 : 0.8}" data-tip="${esc(p.name + ': ' + num(p.v, { dp: 1, suffix: spec.unit?.suffix ?? '' }))}"/>`;
    if (hot) notes.push({ p, cx, cy });
  });
  if (spec.ref) { const rx = x(spec.ref.value); s += Lv(rx, 18, base + 3, C.ink, 1.25); s += T(rx + 5, 26, `${spec.ref.label} ${num(spec.ref.value, { dp: 1, suffix: spec.unit?.suffix ?? '' })}`, { size: 12, fill: C.ink, weight: 600, cls: 'halo' }); }
  // named dots: each label on the lowest row where it meets no other label, its leader ending
  // under the text
  const rowsUsed = [], colTop = cx => base - r - ((bins.get(Math.round((cx - 8) / d)) ?? []).length - 1) * d - r;
  notes.sort((a, b) => a.cx - b.cx).forEach(({ p, cx, cy }) => {
    const text = `${p.name} ${num(p.v, { dp: 1, suffix: spec.unit?.suffix ?? '' })}${p.v > N.hi ? ' →' : p.v < N.lo ? ' ←' : ''}`;
    const w = tw(text, 11.5, 500), left = cx + 3 + w > W - 2, x0 = left ? cx + 3 - w : cx - 3;
    let k = 0; while (rowsUsed.some(u => u.k === k && x0 < u.x1 + 6 && x0 + w > u.x0 - 6)) k++;
    rowsUsed.push({ k, x0, x1: x0 + w });
    const ty = Math.min(cy - 12, colTop(cx) - 12) - k * 15;
    s += `<line x1="${r1(cx)}" x2="${r1(cx)}" y1="${r1(cy - r - 1)}" y2="${r1(ty + 5)}" stroke="${C.faint}"/>`;
    s += T(left ? cx + 3 : cx - 3, ty, text, { size: 11.5, fill: C.ink, weight: 500, anchor: left ? 'end' : 'start', cls: 'halo' });
  });
  return s + '</svg>';
}

// ============================================================================ STACKED BARS (100%)
// Composition across units: one bar per unit, parts in a fixed order and colour, sorted by the
// part the story is about. spec: { width, rows:[{name,parts:[v],highlight?}], parts:[{name,color}], sortBy:index }
export const stackBars = (spec) => finish(_stackBars(spec));
function _stackBars(spec) {
  const W = spec.width, phone = W < 560;
  const rows = spec.rows.map(r => { const t = r.parts.reduce((a, b) => a + (b ?? 0), 0); return { ...r, sh: r.parts.map(v => (v ?? 0) / t * 100) }; });
  const k = spec.sortBy ?? 0; rows.sort((a, b) => (b.highlight ? 1e9 : 0) + b.sh[k] - (a.highlight ? 1e9 : 0) - a.sh[k]);
  const nameW = phone ? 0 : Math.max(...rows.map(r => tw(r.name, 12.5, r.highlight ? 600 : 400))) + 14;
  const bh = phone ? 14 : 16, row = phone ? 38 : 26, keyRows = (() => { let n = 1, kx = phone ? 0 : nameW; for (const p of spec.parts) { const w = tw(p.name, 12) + 34; if (kx + w > W) { n++; kx = phone ? 0 : nameW; } kx += w; } return n; })(), top = keyRows * 20 + 26;
  const H = top + rows.length * row + 4, x0 = nameW, x = v => x0 + v / 100 * (W - x0 - 2);
  let s = svgOpen(W, H, spec.title);
  { let kx = phone ? 0 : nameW, ky = 4; for (const p of spec.parts) { const w = tw(p.name, 12) + 34; if (kx + w > W) { kx = phone ? 0 : nameW; ky += 20; }
      s += `<rect x="${r1(kx)}" y="${ky}" width="10" height="10" fill="${p.color}"/>` + T(kx + 15, ky + 9.5, p.name, { size: 12, fill: C.ink2 }); kx += w; } }
  for (const v of [0, 50, 100]) s += T(x(v), top - 6, v + (v === 100 ? '%' : ''), { size: 11, fill: C.muted, anchor: v === 0 ? 'start' : v === 100 ? 'end' : 'middle', cls: 'tab' });
  rows.forEach((r, i) => {
    const yy = top + i * row + (phone ? 18 : (row - bh) / 2);
    if (phone) s += T(0, yy - 5, r.name, { size: 12.5, fill: C.ink, weight: r.highlight ? 600 : 400 });
    else s += T(nameW - 12, yy + bh / 2 + 4.5, r.name, { size: 12.5, fill: C.ink, weight: r.highlight ? 600 : 400, anchor: 'end' });
    let acc = 0;
    r.sh.forEach((v, j) => { if (!v) return; const a = x(acc), b = x(acc + v); acc += v;
      s += `<rect x="${r1(a)}" y="${yy}" width="${r1(Math.max(0, b - a - 1))}" height="${bh}" fill="${spec.parts[j].color}" data-tip="${esc(r.name + ' · ' + spec.parts[j].name + ': ' + num(v, { dp: 1, suffix: '%' }))}"/>`;
      if (b - a > 34 && j === k) s += T(a + 5, yy + bh / 2 + 4, num(v, { dp: 0, suffix: '%' }), { size: 11, fill: '#fff', weight: 600, cls: 'tab' }); });
  });
  return s + '</svg>';
}

// ============================================================================ FIGURE (the number as the chart)
// spec: { value:'4.8%', label, delta:{text,dir}, spark:[[d,v]], width }
export function spark(data, { width = 132, height = 36, ref } = {}) {
  const P = data.filter(d => d[1] != null);
  const vals = P.map(d => d[1]).concat(ref != null ? [ref] : []);
  const lo = Math.min(...vals), hi = Math.max(...vals);
  const t0 = tnum(P[0][0]), t1 = tnum(P.at(-1)[0]);
  const x = lin(t0, t1, 1, width - 5), y = lin(lo, hi, height - 4, 4);
  let d = ''; P.forEach(([dd, v], i) => { d += `${i ? 'L' : 'M'}${r1(x(tnum(dd)))},${r1(y(v))}`; });
  let s = `<svg class="ak" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" aria-hidden="true">`;
  if (ref != null) s += Lh(0, width, y(ref), C.ctx2, 1).replace('/>', ' stroke-dasharray="1 2.5"/>');
  s += `<path d="${d}L${r1(x(t1))},${height}L${r1(x(t0))},${height}Z" fill="${C.lead}" fill-opacity=".07"/>`;
  s += `<path d="${d}" fill="none" stroke="${C.lead}" stroke-width="1.5" stroke-linejoin="round"/>`;
  s += `<circle cx="${r1(x(t1))}" cy="${r1(y(P.at(-1)[1]))}" r="2.75" fill="${C.lead}" stroke="#fff" stroke-width="1.25"/>`;
  return s + '</svg>';
}

// ============================================================================ FINISH
// The last pass every form's drawing goes through, so two failure classes cannot happen in any
// form, present or future: (1) a text that pokes past the drawing's edge is pulled inside;
// (2) a thin rule (reference line, zero line, leader, median) that crosses a label is broken
// around it, 2px clear. Data strokes are never cut: labels are placed clear of them instead.
const TEXT_RE = /<text\b([^>]*)>([^<]*)<\/text>/g;
const at = (a, k) => { const m = a.match(new RegExp(`\\s${k}="([^"]*)"`)); return m ? m[1] : null; };
function textBox(a, raw) {
  const t = raw.replace(/&lt;/g, '<').replace(/&quot;/g, '"').replace(/&amp;/g, '&');
  const x = +at(a, 'x'), y = +at(a, 'y'), size = +(at(a, 'font-size') ?? 12), weight = +(at(a, 'font-weight') ?? 400);
  const anchor = at(a, 'text-anchor') ?? 'start', w = tw(t, size, weight);
  const x0 = anchor === 'middle' ? x - w / 2 : anchor === 'end' ? x - w : x;
  return { x, x0, x1: x0 + w, y0: y - size * 0.72, y1: y + size * 0.22 };
}
export function finish(svg) {
  const W = +at(svg.slice(0, 300), 'width');
  svg = svg.replace(TEXT_RE, (m, a, raw) => {
    const b = textBox(a, raw), dx = b.x0 < 0 ? -b.x0 : b.x1 > W ? W - b.x1 : 0;
    return dx && Math.abs(dx) < 80 ? `<text${a.replace(/\sx="[^"]*"/, ` x="${r1(b.x + dx)}"`)}>${raw}</text>` : m;
  });
  const boxes = [...svg.matchAll(TEXT_RE)].map(m => textBox(m[1], m[2])).map(b => ({ x0: b.x0 - 2, x1: b.x1 + 2, y0: b.y0 - 2, y1: b.y1 + 2 }));
  return svg.replace(/<line\b([^>]*)\/>/g, (m, a) => {
    const st = at(a, 'stroke'), sw = +(at(a, 'stroke-width') ?? 1);
    if (!st || st === C.grid || sw > 1.5) return m;
    const x1 = +at(a, 'x1'), x2 = +at(a, 'x2'), y1 = +at(a, 'y1'), y2 = +at(a, 'y2');
    const vert = x1 === x2, horiz = y1 === y2; if (!vert && !horiz) return m;
    const [lo, hi] = vert ? [Math.min(y1, y2), Math.max(y1, y2)] : [Math.min(x1, x2), Math.max(x1, x2)];
    const cuts = boxes.filter(b => vert ? x1 > b.x0 && x1 < b.x1 && b.y1 > lo && b.y0 < hi : y1 > b.y0 && y1 < b.y1 && b.x1 > lo && b.x0 < hi)
      .map(b => vert ? [b.y0, b.y1] : [b.x0, b.x1]).sort((p, q) => p[0] - q[0]);
    if (!cuts.length) return m;
    const keep = []; let cur = lo;
    for (const [c0, c1] of cuts) { if (c0 > cur + 1) keep.push([cur, c0]); cur = Math.max(cur, c1); }
    if (hi > cur + 1) keep.push([cur, hi]);
    return keep.map(([u, v]) => `<line${a.replace(vert ? /\sy1="[^"]*"/ : /\sx1="[^"]*"/, vert ? ` y1="${r1(u)}"` : ` x1="${r1(u)}"`).replace(vert ? /\sy2="[^"]*"/ : /\sx2="[^"]*"/, vert ? ` y2="${r1(v)}"` : ` x2="${r1(v)}"`)}/>`).join('');
  });
}
