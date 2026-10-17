// Measure of India chart kit, v5 (from scratch, 2026-10-15).
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
  grid: '#EBECEE', base: '#1E2126', ctx: '#B0B4BA', ctx2: '#CBCED3', wash: '#F4F5F6', paper: '#FFFFFF',
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
  const fixed = dp > 0 && !body.includes('.') ? body + '.' + '0'.repeat(dp) : dp > 0 ? body.replace(/\.(\d*)$/, (_, f) => '.' + f.padEnd(dp, '0')) : body; // 8.30 keeps its zero at dp 2
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
  if (freq === 'fy') return `${y}-${String((+y + 1) % 100).padStart(2, '0')}`; // Indian financial year, April start
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
  // the first step whose ticks fit and still name at least two years (a short span on a phone
  // with 5-year steps would show a single year)
  const steps = [1, 2, 3, 5, 10, 20, 25, 50, 100];
  const at = st => { const o = []; for (let y = Math.ceil(t0 / st - 1e-9) * st; y <= t1 + 1e-6; y += st) o.push({ t: y, label: String(y) }); return o; };
  for (const st of steps) { const o = at(st); if (o.length <= fit && o.length >= 2) return o; }
  return at(steps.find(s => span / s <= fit) ?? 100);
}

// as many whole words of a name as fit a width; the first word always
function fitWords(name, width, size = 12, weight = 400) {
  const w = String(name).split(/ +/); let out = w[0]; // ordinary spaces only: a no-break space keeps words together
  for (let i = 1; i < w.length; i++) { const t = out + ' ' + w[i]; if (tw(t, size, weight) > width) break; out = t; }
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
function yAxis({ ticks, y, x0, x1, unit = {}, dp, fmt = null }) {
  const top = ticks.at(-1);
  let s = '';
  for (const v of ticks) {
    const isZero = v === 0;
    s += Lh(x0, x1, y(v), isZero ? C.base : C.grid, 1);
    const lab = fmt ? fmt(v) : num(v, { dp, group: true, prefix: v === top ? unit.prefix ?? '' : '', suffix: v === top ? unit.suffix ?? '' : '' });
    s += T(x0, y(v) - 5, lab, { size: 12, fill: C.muted, cls: 'tab halo' });
  }
  return s;
}
function xTimeAxis({ ticks, x, y, tick = true, lo = 0, hi = Infinity }) {
  let s = '', last = -Infinity; // a label that would touch the one before it is skipped (wide FY labels on a phone)
  for (const k of ticks) { // k.anchor 'start' | 'end': a label set from its tick inward (the ends of a phone axis)
    const w = tw(k.label, 12), a0 = k.anchor === 'start' ? x(k.t) : k.anchor === 'end' ? x(k.t) - w : x(k.t) - w / 2;
    if (a0 < lo - 2 || a0 + w > hi + 2 || a0 < last + 8) continue;
    last = a0 + w;
    if (tick) s += Lv(x(k.t), y, y + 4, C.faint);
    s += T(x(k.t), y + 18, k.label, { size: 12, fill: C.muted, anchor: k.anchor ?? 'middle', cls: 'tab' });
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
  for (const s of series) { let prev = null; for (const p of s.pts) { if (p.v == null) { prev = null; continue; } if (p.stage) { const q = [x(p.t), y(p.v)]; out.push([q[0], q[1], q[0], q[1]]); prev = null; continue; } const q = [x(p.t), y(p.v)]; if (prev) out.push([prev[0], prev[1], q[0], q[1]]); else out.push([q[0], q[1], q[0], q[1]]); prev = q; } }
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

// More points than pixels (a weekly series over decades, drawn 360 px wide) only adds bytes:
// keep, for each pixel column, the first, lowest, highest and last point in time order, so the
// drawn shape is exactly the same. Gaps (nulls) and staged points pass through untouched.
// A phone drawing thins by 2 px columns: its lines are 2.25 px thick, so the shape is unchanged and
// a dense series costs half the bytes (the plot running to the edge had doubled them; 2026-10-17).
function thinPts(pts, x, colW = 1) {
  if (pts.length < 400) return pts;
  const out = []; let col = null, buf = [];
  const flush = () => { if (!buf.length) return; if (buf.length <= 4) { out.push(...buf); buf = []; return; }
    let lo = buf[0], hi = buf[0]; for (const q of buf) { if (q.v < lo.v) lo = q; if (q.v > hi.v) hi = q; }
    const keep = new Set([buf[0], lo, hi, buf.at(-1)]); out.push(...buf.filter(q => keep.has(q))); buf = []; };
  for (const p of pts) {
    if (p.v == null || p.stage) { flush(); col = null; out.push(p); continue; }
    const c = Math.floor(x(p.t) / colW); if (c !== col) { flush(); col = c; }
    buf.push(p);
  }
  flush();
  return out;
}

// ============================================================================ LINE
// spec: { width, height?, series:[{name, data:[[date,v]], role:'lead'|'ctx'|'comp'|'cat', color?, step?, label?}],
//         unit:{prefix,suffix}, dp, yDomain?, band:{from,to,label}, refs:[{y,label}], events:[{t,label}],
//         shade:[{from,to,label}], seam:{t,before,after}, freq, endFormat? }
export const line = (spec) => finish(_line(spec));
function _line(spec) {
  const W = spec.width, phone = W < 520;
  let H = spec.height ?? (phone ? 260 : Math.round(Math.min(420, Math.max(300, W * 0.42))));
  // optional (public-finance port): series.stages:[[date, v, 're'|'be']], a budget's revised and budget
  // estimates after the accounts: drawn as marks (re filled pale, be hollow), never joined to the line
  const S = spec.series.map((s, i) => { const st = new Map((s.stages ?? []).map(([d, v, k]) => [d, { v, k }]));
    const pts = s.data.map(([d, v]) => (v == null && st.has(d) ? { d, t: tnum(d), v: st.get(d).v, stage: st.get(d).k } : { d, t: tnum(d), v }));
    for (const [d, o] of st) if (!s.data.some(p => p[0] === d)) pts.push({ d, t: tnum(d), v: o.v, stage: o.k });
    if (st.size) pts.sort((a, b) => a.t - b.t);
    return { ...s, pts }; });
  const all = S.flatMap(s => s.pts.filter(p => p.v != null));
  const t0 = spec.tDomain?.[0] ?? Math.min(...all.map(p => p.t)), t1 = spec.tDomain?.[1] ?? Math.max(...all.map(p => p.t));
  let vmin = Math.min(...all.map(p => p.v), ...(spec.band ? [spec.band.from] : []), ...(spec.refs ?? []).map(r => r.y));
  let vmax = Math.max(...all.map(p => p.v), ...(spec.band ? [spec.band.to] : []), ...(spec.refs ?? []).map(r => r.y));
  if (spec.zero !== false && !spec.log && vmin > 0 && vmin < (vmax - vmin) * 0.6) vmin = 0;
  let N = nice(...(spec.yDomain ?? [vmin, vmax]), spec.yCount ?? (phone ? 4 : 5)); // optional: spec.yCount, more gridlines (a finer step)
  if (vmin > 0 && Math.abs(vmin - N.lo) < N.step * 0.15) N = { ...N, lo: N.lo - N.step * 0.3 };
  // log: true, a logarithmic y axis (values that span powers of ten); gridlines at each power
  if (spec.log) { const a = Math.floor(Math.log10(spec.yDomain?.[0] ?? vmin) + 1e-9), b = Math.ceil(Math.log10(spec.yDomain?.[1] ?? vmax) - 1e-9);
    N = { lo: 10 ** a, hi: 10 ** b, step: 1, ticks: Array.from({ length: b - a + 1 }, (_, i) => +(10 ** (a + i)).toPrecision(1)) }; }
  const logLab = v => num(v, { dp: v < 1 ? Math.round(-Math.log10(v)) : 0, prefix: v === N.ticks.at(-1) ? spec.unit?.prefix ?? '' : '', suffix: v === N.ticks.at(-1) ? spec.unit?.suffix ?? '' : '' });
  const dp = spec.dp ?? dpOf(N.step);
  const fmtEnd = spec.endFormat ?? (v => num(v, { dp: spec.endDp ?? 1, prefix: spec.unit?.prefix ?? '', suffix: spec.unit?.suffix ?? '' }));

  // end labels decide the right margin
  const labelled = S.filter(s => s.label !== false && s.pts.some(p => p.v != null));
  // optional (poverty port): series.endLabel, the end label's text in place of the last value (curves that all end at 100%)
  const endText = s => { const last = s.pts.filter(p => p.v != null).at(-1); return { v: s.endLabel ?? fmtEnd(last.v), n: s.short ?? s.name }; };
  const maxLab = Math.max(0, ...labelled.map(s => { const e = endText(s); return Math.max(tw(e.v, 13, 600), spec.endSub ? tw(spec.endSub, 12) : spec.nameOnEnd === false ? 0 : tw(e.n, 12)); }));
  // spec.inside:false (cpi port) keeps a lone series' end label in the right margin on a phone too,
  // for a line whose last stretch leaves no clear spot inside the plot
  const inside = phone && labelled.length === 1 && spec.inside !== false;
  // optional (debt port): spec.right, a fixed right margin, so stacked panels share one time axis
  const right = spec.right ?? (inside ? 6 : labelled.length ? Math.min(phone ? 92 : 170, maxLab + 14) : 8);
  let top = 26 + (spec.events?.length || spec.seam ? 18 : 0); const bottom = 30;
  // optional (learn port): spec.gutter, a fixed left gutter, so two stacked charts share one time axis (with spec.right)
  let G = spec.gutter != null ? spec.gutter : spec.log ? Math.ceil(Math.max(...N.ticks.map(v => tw(logLab(v), 12)))) + 10 : gutterFor(N.ticks, spec.unit, dp);
  const yOf = () => spec.log ? (ly => v => ly(Math.log10(v)))(lin(Math.log10(N.lo), Math.log10(N.hi), H - bottom, top)) : lin(N.lo, N.hi, H - bottom, top);
  let y = yOf();
  // phone (2026-10-17): the plot takes the width its labels leave it. The y labels sit on their
  // gridlines over the plot's left edge wherever no line passes under them, so the gutter is only as
  // wide as the lines need; and the end labels go inside the plot, left of their dots, when every one
  // finds clear space, so the right margin is only the dot's. When two or more cannot, they become a
  // key above the plot, each series' line, name and last value, and the plot still runs to the edge.
  let insideEnds = null, R = right, yLabBoxes = [], phoneKey = null;
  if (phone && !spec.shade?.length && !spec.ranges?.length && !spec.notes?.length && !spec.pointLabels?.length) {
    const top1 = N.ticks.at(-1), labsAt = () => N.ticks.filter(v => v >= N.lo - 1e-9).map(v => {
      const w = tw(spec.log ? logLab(v) : num(v, { dp, prefix: v === top1 ? spec.unit?.prefix ?? '' : '', suffix: v === top1 ? spec.unit?.suffix ?? '' : '' }), 12);
      return { x0: -2, x1: w + 4, y0: y(v) - 16, y1: y(v) - 1 };
    });
    let yLabs = labsAt();
    const segsAt = (g, r) => { const xs = lin(t0, t1, g, W - r);
      return segsOf(S, xs, y).concat([...(spec.events ?? []).map(e => tnum(e.t)), ...(spec.seam ? [tnum(spec.seam.t)] : [])].map(t => [xs(t), 0, xs(t), H - bottom])); };
    const gutterAt = r => { if (spec.gutter != null) return G;
      for (let g = 4; g < G; g += 2) if (yLabs.every(b => clearance(b, segsAt(g, r)) >= 2)) return g;
      return G; };
    // each end label as a box right-aligned just left of its dot, above or below it, clear of every
    // stroke, every y label and the labels placed before it
    const fitEnds = (g, r) => {
      const xs = lin(t0, t1, g, W - r), segs = segsAt(g, r), taken = yLabs.slice(), out = [];
      const two = (spec.nameOnEnd !== false && labelled.length > 1) || !!spec.endSub, yMin = spec.events?.length || spec.seam ? top + 4 : 2;
      for (const sr of labelled.slice().sort((a, b) => y(a.pts.filter(p => p.v != null).at(-1).v) - y(b.pts.filter(p => p.v != null).at(-1).v))) {
        const last = sr.pts.filter(p => p.v != null).at(-1), e = endText(sr), n = spec.endSub ?? e.n;
        const ex = xs(last.t), ey = y(last.v), w = Math.max(tw(e.v, 13, 600), two ? tw(n, 12) : 0), h = two ? 29 : 14;
        let best = null;
        for (const k of [0, 1, 2, 3, 4]) for (const below of [false, true]) {
          const y0 = below ? ey + 6 + k * 5 : ey - 6 - k * 5 - h, box = { x0: ex - 7 - w, x1: ex - 5, y0, y1: y0 + h };
          if (box.x0 < g + 2 || y0 < yMin || box.y1 > H - bottom - 3) continue;
          const c = Math.min(clearance(box, segs, taken), 12) - k * 0.75;
          if (c >= 3 && (!best || c > best.c + 0.5)) best = { c, box, ly: y0 + 11 };
        }
        if (!best) return null;
        taken.push(best.box); out.push({ sr, last, e: { ...e, n }, two, xr: best.box.x1, ly: best.ly, box: best.box });
      }
      return out;
    };
    if (labelled.length && spec.right == null && !inside && labelled.length <= 3) {
      const g = gutterAt(6), fit = fitEnds(g, 6);
      if (fit) { insideEnds = fit; R = 6; G = g; }
      else if (labelled.length >= 2 && spec.phoneKey !== false) { // optional: spec.phoneKey:false keeps the margin labels
        const items = labelled.map(sr => ({ sr, last: sr.pts.filter(p => p.v != null).at(-1), e: endText(sr) })).sort((a, b) => b.last.v - a.last.v);
        const rows = [[]]; let cx = 0;
        for (const it of items) { it.w = 16 + tw(it.sr.short ?? it.e.n, 12) + 5 + tw(it.e.v, 13, 600);
          if (cx && cx + 20 + it.w > W) { rows.push([]); cx = 0; }
          it.x = cx ? cx + 20 : 0; cx = it.x + it.w; rows.at(-1).push(it); }
        const kh = rows.length * 20 + 6; H += kh; top += kh; y = yOf(); yLabs = labsAt();
        phoneKey = rows.map((r, i) => r.map(it => ({ ...it, ly: 15 + i * 20 }))).flat(); R = 6;
      }
    }
    G = insideEnds ? G : gutterAt(R);
    yLabBoxes = yLabs;
  }
  const x = lin(t0, t1, G, W - R);
  const colorOf = s => s.color ?? (s.role === 'lead' ? C.lead : s.role === 'comp' ? C.comp : s.role === 'ctx2' ? C.ctx2 : C.ctx);
  let s = svgOpen(W, H, spec.title, hoverAttr({
    x: [r1(G), r1(x(t1)), t0, t1], y: [r1(y(N.lo)), r1(y(N.hi)), N.lo, N.hi], f: spec.freq ?? 'month', ...(spec.log ? { l: 1 } : {}),
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
  // optional (rates port): spec.ranges:[{data:[[date, lo, hi]], color?}], a range that moves over time
  // (the spread of banks' quoted rates), filled under the grid; a null in either bound breaks it
  for (const rg of spec.ranges ?? []) {
    let run = [];
    const flush = () => { if (run.length > 1) s += `<path d="${run.map((p, i) => `${i ? 'L' : 'M'}${r1(x(tnum(p[0])))},${r1(y(p[2]))}`).join('')}${run.slice().reverse().map(p => `L${r1(x(tnum(p[0])))},${r1(y(p[1]))}`).join('')}Z" fill="${rg.color ?? C.leadWash}"/>`; run = []; };
    for (const p of rg.data) { if (p[1] == null || p[2] == null) flush(); else run.push(p); }
    flush();
  }
  s += yAxis({ ticks: N.ticks.filter(v => v >= N.lo - 1e-9), y, x0: 0, x1: W, unit: spec.unit, dp, fmt: spec.log ? logLab : null });
  // band and reference labels sit inside the plot's top-left, clear of the end labels
  const inPlot = []; // labels placed after the series are known
  if (spec.band?.label) { const bt = y(spec.band.to), bb = y(spec.band.from); inPlot.push({ text: spec.band.label, key: 'Shaded: ' + spec.band.label, ly: [bt + 15, bb - 5, bt - 5, bb + 15] }); }
  for (const r of spec.refs ?? []) { // optional (farms port): r.from, a date the reference starts at (a norm set in 2015)
    const rx0 = r.from ? x(tnum(r.from)) : G;
    s += Lh(rx0, x(t1), y(r.y), C.ink2, 1).replace('/>', ' stroke-dasharray="1 3" stroke-linecap="round"/>');
    if (r.label) inPlot.push({ text: r.label, key: 'Dotted line: ' + r.label, ly: [y(r.y) - 6, y(r.y) + 15], x0: r.from ? rx0 : undefined });
  }
  if (N.lo !== 0) s += Lh(0, W, H - bottom, C.base, 1);
  // freq 'fy' (dates at 1 April): ticks sit on the financial years and read 2011-12
  // optional (gdp port): spec.xTicks:[{t, label, short?}], ticks of the caller's own (the stages of an
  // estimate drawn at t = 0, 1, 2...); a phone shows the short label
  let xt = spec.xTicks ? spec.xTicks.map(k => ({ t: tnum(k.t), label: phone && k.short ? k.short : k.label })) : spec.freq === 'fy' ? timeTicks(t0 - 0.25, t1 - 0.25, W - R - G).map(k => ({ t: k.t + 0.25, label: tlabel(Math.round(k.t) + '-04', 'fy') })).filter(k => k.t >= t0 - 1e-6 && k.t <= t1 + 1e-6) : timeTicks(t0, t1, W - R - G);
  // phone: the first and last periods are named at the ends of the axis, so the span reads at a
  // glance; the round years between stay where they clear both
  if (phone && !spec.xTicks && spec.tDomain == null) {
    const dOf = t => all.reduce((a, p) => Math.abs(p.t - t) < Math.abs(a.t - t) ? p : a).d;
    const yearly = S.some(sr => sr.pts.length > 1 && sr.pts[1].t - sr.pts[0].t > 0.9);
    const lab = d => tlabel(d, spec.freq ?? (yearly ? 'year' : 'month'));
    const a = { t: t0, label: lab(dOf(t0)), anchor: 'start' }, b = { t: t1, label: lab(dOf(t1)), anchor: 'end' };
    const ax1 = x(t0) + tw(a.label, 12) + 10, bx0 = x(t1) - tw(b.label, 12) - 10;
    // between the ends, the round periods that clear them by a label's width, kept from the middle
    // outward so the ones shown are evenly spread
    const mid = xt.filter(k => { const h = tw(k.label, 12) / 2; return x(k.t) - h > ax1 + 6 && x(k.t) + h < bx0 - 6; })
      .sort((p, q) => Math.abs(x(p.t) - (x(t0) + x(t1)) / 2) - Math.abs(x(q.t) - (x(t0) + x(t1)) / 2)), keep = [];
    for (const k of mid) { const h = tw(k.label, 12) / 2; if (keep.every(q => Math.abs(x(q.t) - x(k.t)) > h + tw(q.label, 12) / 2 + 24)) keep.push(k); }
    xt = [a, ...keep.sort((p, q) => p.t - q.t), b];
  }
  if (spec.xUnit && xt.length) xt[xt.length - 1] = { ...xt.at(-1), label: xt.at(-1).label + spec.xUnit }; // optional (rates port): a unit on the last x label ("30 years")
  s += xTimeAxis({ ticks: xt, x, y: H - bottom, lo: spec.xTicks ? -1e9 : 0, hi: spec.xTicks ? 1e9 : W }); // the caller's own ticks are all kept; finish() pulls an edge label inside

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
    const col = colorOf(sr), w = sr.role === 'lead' || sr.role === 'comp' ? 2.25 : sr.role === 'cat' ? 2 : 1.25;
    let d = '', pen = false, prev = null;
    for (const p of sr.step ? sr.pts : thinPts(sr.pts, x, phone ? 2 : 1)) {
      if (p.v == null || p.stage) { pen = false; continue; }
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
      // a null inside either stretch is a gap, never a straight join (rates port: a series that starts, pauses, resumes)
      const cut = tnum(sr.recon), a = sr.pts.filter(p => p.t <= cut + 1e-6), b = sr.pts.filter(p => p.t >= cut - 1 / 12 - 1e-6);
      const path = P => { let e = '', on = false; for (const p of P) { if (p.v == null) { on = false; continue; } e += `${on ? 'L' : 'M'}${r1(x(p.t))},${r1(y(p.v))}`; on = true; } return e; };
      s += `<path d="${path(a)}" fill="none" stroke="${C.leadSoft}" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round"/>`;
      s += `<path d="${path(b)}" fill="none" stroke="${col}" stroke-width="${w}" stroke-linejoin="round" stroke-linecap="round"/>`;
      continue;
    }
    // est: the agency's own estimate from this date on, not a measurement: the same line, pale
    // and dashed from the last measured point (CONTRACT-series 2b); its end dot is drawn hollow
    const iEst = sr.est ? sr.pts.findIndex(p => p.t >= tnum(sr.est) - 1e-6) : -1;
    if (iEst > 0) {
      const path = P => { let e = '', on = false; for (const p of P) { if (p.v == null) { on = false; continue; } e += `${on ? 'L' : 'M'}${r1(x(p.t))},${r1(y(p.v))}`; on = true; } return e; };
      const pale = sr.role === 'lead' ? C.leadSoft : sr.role === 'comp' ? C.compTint : col;
      s += `<path d="${path(sr.pts.slice(0, iEst))}" fill="none" stroke="${col}" stroke-width="${w}" stroke-linejoin="round" stroke-linecap="round"/>`;
      s += `<path d="${path(sr.pts.slice(iEst - 1))}" fill="none" stroke="${pale}" stroke-width="${w}" stroke-dasharray="3 3" stroke-linejoin="round"/>`;
      continue;
    }
    // the lead line drawn over grey context lines wears a thin paper casing, so where it crosses one
    // the two stay distinct; never over a coloured series, which it would erase where they meet, and
    // not on a dense line (300 vertices or more), where it doubles the bytes for nothing seen (2026-10-17)
    if (sr.line !== false && sr.role === 'lead' && !sr.dash && S.length > 1 && (d.match(/[ML]/g) ?? []).length < 300 && S.every(o => o === sr || o.role === 'ctx' || o.role === 'ctx2' || (!o.role && !o.color))) s += `<path d="${d}" fill="none" stroke="#fff" stroke-width="${w + 1.5}" stroke-linejoin="round" stroke-linecap="round"/>`;
    if (sr.line !== false) s += `<path d="${d}" fill="none" stroke="${col}" stroke-width="${w}" stroke-linejoin="round" stroke-linecap="round"${sr.dash ? ` stroke-dasharray="${sr.dash}"` : ''}/>`; // series.line:false, dots only (with series.dots)
  }
  for (const sr of S) for (const p of sr.pts) if (p.stage) { const col = colorOf(sr); // stage marks, over every line
    s += p.stage === 'be' ? `<circle cx="${r1(x(p.t))}" cy="${r1(y(p.v))}" r="4" fill="#fff" stroke="${col}" stroke-width="1.75"/>`
      : `<circle cx="${r1(x(p.t))}" cy="${r1(y(p.v))}" r="4" fill="${sr.role === 'lead' ? C.leadSoft : col}"${sr.role === 'lead' ? '' : ' fill-opacity=".6"'} stroke="#fff" stroke-width="1.25"/>`; }
  // optional (poverty port): series.dots:true, a dot on every reading (sparse surveys, where a
  // lone reading has no line to show it); series.dots:'open' draws them hollow
  for (const sr of S) if (sr.dots) for (const p of sr.pts) if (p.v != null && !p.stage) { const col = colorOf(sr);
    s += sr.dots === 'open' ? `<circle cx="${r1(x(p.t))}" cy="${r1(y(p.v))}" r="3" fill="#fff" stroke="${col}" stroke-width="1.5"/>`
      : `<circle cx="${r1(x(p.t))}" cy="${r1(y(p.v))}" r="4" fill="${col}" stroke="#fff" stroke-width="1.5"/>`; }
  // notes on single points: a ringed dot, a short leader, two lines of text
  const noteBoxes = [];
  const noteSegs = segsOf(S, x, y).concat(vrules.map(vx => [vx, top - 30, vx, H - bottom]));
  // a note keeps clear of every label already drawn (seam and event labels, shade labels) (population port)
  const drawnLabs = spec.notes?.length ? [...s.matchAll(TEXT_RE)].map(m => textBox(m[1], m[2])) : [];
  for (const n of spec.notes ?? []) {
    const px = x(tnum(n.d)), py = y(n.v), lines = n.text.split('\n');
    const nw = Math.max(...lines.map((ln, k) => tw(ln, 12, k ? 400 : 600))), nh = lines.length * 14;
    // the asked-for side and height first, then the others; the clearest wins
    const pref = [[n.side ?? 'right', n.below ?? false], [n.side ?? 'right', !(n.below ?? false)], [(n.side ?? 'right') === 'right' ? 'left' : 'right', n.below ?? false], [(n.side ?? 'right') === 'right' ? 'left' : 'right', !(n.below ?? false)]];
    const yLabs = N.ticks.map(v => ({ x0: 0, x1: G - 6, y0: y(v) - 16, y1: y(v) - 1 })); // a note never sits on a y-axis label (gdp port)
    const far = n.dy ?? 0; // optional (gdp port): n.dy, extra px between the point and its note (a longer leader into clear space)
    const fits = ([sd, bl]) => { const tx = sd === 'right' ? px + 14 : px - 14, ty = bl ? py + 22 + far : py - 14 - (lines.length - 1) * 14 - far; const x0 = sd === 'right' ? tx : tx - nw;
      if (x0 < 0 || x0 + nw > W || ty - 11 < 0 || ty + nh - 14 > H - bottom) return -99; return clearance({ x0: x0 - 3, x1: x0 + nw + 3, y0: ty - 11, y1: ty + nh - 11 }, noteSegs, yLabs.concat(drawnLabs, spec.noteAvoid ? noteBoxes : [])); }; // optional (learn port): spec.noteAvoid, each note keeps clear of the notes placed before it
    const [side, below] = pref.reduce((a, b) => fits(b) > fits(a) + 1 ? b : a, pref[0]);
    const tx = side === 'right' ? px + 14 : px - 14, anchor = side === 'right' ? 'start' : 'end';
    const ty = below ? py + 22 + far : py - 14 - (lines.length - 1) * 14 - far;
    { const x0 = side === 'right' ? tx : tx - nw; noteBoxes.push({ x0: x0 - 3, x1: x0 + nw + 3, y0: ty - 12, y1: ty + nh - 10 }); }
    s += `<circle cx="${r1(px)}" cy="${r1(py)}" r="4" fill="none" stroke="${C.ink}" stroke-width="1.25"/>`;
    const ly = below ? ty - 11 : ty + (lines.length - 1) * 14 + 4;
    s += `<path d="M${r1(px + (side === 'right' ? 4 : -4))},${r1(py - (below ? -4 : 4))}L${r1(tx + (side === 'right' ? -4 : 4))},${r1(ly)}" stroke="${C.ink}" stroke-width="1" fill="none"/>`;
    lines.forEach((ln, k) => { s += T(tx, ty + k * 14, ln, { size: 12, fill: k ? C.ink2 : C.ink, weight: k ? 400 : 600, anchor, cls: 'halo' }); });
  }
  // in-plot labels go where no stroke and no other label is; one that finds no clear spot
  // becomes a line of the key under the chart instead of sitting on the data
  const segs = segsOf(S, x, y), taken = [...noteBoxes, ...yLabBoxes, ...(insideEnds ?? []).map(p => p.box)], keyNotes = [];
  if (inside) { const lp = labelled[0].pts.filter(p => p.v != null).at(-1), ex = x(lp.t), ey = y(lp.v), w = tw(fmtEnd(lp.v), 13, 600); taken.push({ x0: ex - w - 8, x1: ex + 6, y0: ey - 40, y1: ey + 40 }); }
  for (const l of inPlot) {
    const w = tw(l.text, 11.5), cands = l.ly.filter(v => v - 11 > top - 2 && v < H - bottom - 2);
    const spot = placeLabel(w, cands.length ? cands : [l.ly[0]], segs, taken, l.x0 ?? G, x(t1));
    if (spot.clear < 1.5) { keyNotes.push(l.key); continue; }
    taken.push({ x0: spot.x - 3, x1: spot.x + w + 3, y0: spot.ly - 11, y1: spot.ly + 3 });
    s += T(spot.x, spot.ly, l.text, { size: 11.5, fill: C.ink2, cls: 'halo' });
  }
  // optional (deposits port): spec.pointLabels:[{d, v, text}], a small dot on the point and a
  // quiet second figure set right-below it (a rising line leaves that corner empty)
  for (const pl of spec.pointLabels ?? []) {
    const px = x(tnum(pl.d)), py = y(pl.v);
    s += `<circle cx="${r1(px)}" cy="${r1(py)}" r="2.75" fill="${C.lead}" stroke="#fff" stroke-width="1.25"/>`;
    s += T(px + 5, py + 16, pl.text, { size: 11.5, fill: C.ink2, cls: 'tab halo' });
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
    if (!p.last.stage) s += `<circle cx="${r1(ex)}" cy="${r1(ey)}" r="3.75" fill="${col}" stroke="#fff" stroke-width="2"/>`;
    // above or below the last point, whichever stays clearer of the line
    const w = tw(p.e.v, 13, 600), pts = S.flatMap(sr => sr.pts.filter(q => q.v != null).map(q => [x(q.t), y(q.v)])).filter(([px]) => px >= ex - w - 8 && px <= ex);
    // clearance against the strokes themselves (a steep segment between two points counts), not only the points
    const segsIn = segsOf(S, x, y), clear = ly => Math.min(Math.min(...pts.map(([, py]) => Math.max(py - ly - 3, ly - 13 - py)), 99), clearance({ x0: ex - 2 - w - 2, x1: ex, y0: ly - 12, y1: ly + 3 }, segsIn) + 3);
    const cands = [ey - 11, ey + 21, ey - 26, ey + 36, ey - 41, ey + 51].filter(ly => ly - 12 > top - 14 && ly < H - bottom - 2);
    const ly = cands.reduce((a, b) => clear(b) > clear(a) + 2 ? b : a, cands[0] ?? ey - 11);
    s += T(ex - 2, ly, p.e.v, { size: 13, fill: C.ink, weight: 600, anchor: 'end', cls: 'tab halo' });
  }
  else if (phoneKey) for (const k of phoneKey) {
    const col = colorOf(k.sr), ex = x(k.last.t), ey = y(k.last.v);
    if (!k.last.stage) s += k.sr.est && k.last.t >= tnum(k.sr.est) - 1e-6 ? `<circle cx="${r1(ex)}" cy="${r1(ey)}" r="3.5" fill="#fff" stroke="${col}" stroke-width="1.75"/>` : `<circle cx="${r1(ex)}" cy="${r1(ey)}" r="3.75" fill="${col}" stroke="#fff" stroke-width="2"/>`;
    s += `<line x1="${r1(k.x)}" x2="${r1(k.x + 12)}" y1="${k.ly - 4}" y2="${k.ly - 4}" stroke="${col}" stroke-width="${k.sr.role === 'lead' || k.sr.role === 'comp' ? 2.5 : 2}" stroke-linecap="round"/>`;
    const nm = k.sr.short ?? k.e.n;
    s += T(k.x + 16, k.ly, nm, { size: 12, fill: C.ink2 });
    s += T(k.x + 16 + tw(nm, 12) + 5, k.ly, k.e.v, { size: 13, fill: C.ink, weight: 600, cls: 'tab' });
  }
  else if (insideEnds) for (const p of insideEnds) {
    const col = colorOf(p.sr), ex = x(p.last.t), ey = y(p.last.v);
    if (p.last.stage) {}
    else if (p.sr.est && p.last.t >= tnum(p.sr.est) - 1e-6) s += `<circle cx="${r1(ex)}" cy="${r1(ey)}" r="3.5" fill="#fff" stroke="${col}" stroke-width="1.75"/>`;
    else s += `<circle cx="${r1(ex)}" cy="${r1(ey)}" r="3.75" fill="${col}" stroke="#fff" stroke-width="2"/>`;
    s += T(p.xr, p.ly, p.e.v, { size: 13, fill: C.ink, weight: 600, anchor: 'end', cls: 'tab halo' });
    if (p.two) s += T(p.xr, p.ly + 15, p.e.n, { size: 12, fill: C.ink2, anchor: 'end', cls: 'halo' });
  }
  else for (const p of settle(ends, 16, top - 4, H - bottom + 4)) {
    const lx = x(t1) + 10, col = colorOf(p.sr), ey = y(p.last.v);
    if (p.last.stage) {} // the stage mark is the end dot
    else if (p.sr.est && p.last.t >= tnum(p.sr.est) - 1e-6) s += `<circle cx="${r1(x(p.last.t))}" cy="${r1(ey)}" r="3.5" fill="#fff" stroke="${col}" stroke-width="1.75"/>`;
    else s += `<circle cx="${r1(x(p.last.t))}" cy="${r1(ey)}" r="3.75" fill="${col}" stroke="#fff" stroke-width="2"/>`;
    const ly = p.y + (p.two ? 12 : 5);
    if (Math.abs(ly - ey) > 6) s += `<path d="M${r1(x(p.last.t) + 5)},${r1(ey)}L${r1(lx - 3)},${r1(ly - 4)}" stroke="${C.faint}" fill="none"/>`;
    s += T(lx, ly, p.e.v, { size: 13, fill: C.ink, weight: 600, cls: 'tab' });
    // on a phone the name keeps as many whole words as fit beside the plot (the series' short
    // name first, when it has one), not just its first word
    if (p.two) s += T(lx, ly + 15, phone ? fitWords(p.sr.short ?? p.e.n, W - lx - 2, 12) : p.e.n, { size: 12, fill: C.ink2 });
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
  const markVals = (spec.marks ?? []).map(m => m[1]).filter(v => v != null); // spec.marks stay on the scale (external port)
  const N = nice(Math.min(0, ...vals, ...markVals), Math.max(0, ...vals, ...markVals), 5);
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
    const fill = spec.fillOf?.(p, i) ?? (last ? (neg ? C.comp : C.lead) : neg ? C.compTint : C.leadTint); // optional (climate port): spec.fillOf(p, i) picks columns out
    const y0 = y(0), y1 = y(p.v);
    s += `<rect x="${r1(cx(i) - bw / 2)}" y="${r1(Math.min(y0, y1))}" width="${r1(bw)}" height="${r1(Math.max(.75, Math.abs(y1 - y0)))}" fill="${fill}" data-tip="${esc(tlabel(p.d, spec.freq) + ': ' + (spec.fmt ? spec.fmt(p.v) : num(p.v, { dp: spec.valueDp ?? 1, sign: !!spec.sign, suffix: spec.unit?.suffix ?? '' })))}"/>`;
  });
  s += Lh(0, W - right, y(0), C.base, 1);
  // optional (rates port): spec.zeroMark, a ring on the baseline for a period whose value is exactly zero (a meeting that held)
  if (spec.zeroMark) P.forEach((p, i) => { if (p.v === 0) s += `<circle cx="${r1(cx(i))}" cy="${r1(y(0))}" r="${r1(Math.max(2, Math.min(3.5, slot / 2 - 0.75)))}" fill="#fff" stroke="${C.muted}" stroke-width="1.25" data-tip="${esc(tlabel(p.d, spec.freq) + ': ' + (spec.zeroMark === true ? num(0, { dp: spec.valueDp ?? 1, suffix: spec.unit?.suffix ?? '' }) : spec.zeroMark))}"/>`; });
  // optional (climate port): spec.ref {y, label}, a dotted benchmark across the columns, named in a key line above the plot
  if (spec.ref) { s += Lh(G, W - right, y(spec.ref.y), C.ink, 1).replace('/>', ' stroke-dasharray="1 3" stroke-linecap="round"/>');
    s += `<path d="M${r1(G)},10.5H${r1(G + 18)}" stroke="${C.ink}" stroke-dasharray="1 3" stroke-linecap="round"/>` + T(G + 24, 14, spec.ref.label, { size: 12, fill: C.ink2 }); }
  // year ticks under the columns
  const t0 = tnum(P[0].d), t1 = tnum(P.at(-1).d);
  const tt = timeTicks(t0, t1 + 0.25, W - G);
  const pos = t => { const k = P.findIndex(p => tnum(p.d) >= t - 1e-6); return k < 0 ? null : cx(k) - slot / 2; };
  // optional (profiles port): freq 'fy' labels the year ticks 2012-13 (dates at 1 April)
  let lastX = -Infinity; // a label that would touch the one before it is skipped
  for (const k of tt) { const px = pos(k.t); if (px == null) continue; const lab = spec.freq === 'fy' ? tlabel(Math.round(k.t) + '-04', 'fy') : k.label; if (px + 2 < lastX + 8 || px + 2 + tw(lab, 12) > W + 1) continue; lastX = px + 2 + tw(lab, 12); s += Lv(px, H - bottom, H - bottom + 5, C.base); s += T(px + 2, H - bottom + 19, lab, { size: 12, fill: C.muted, cls: 'tab' }); }
  // optional (profiles port): spec.marks [[date, v]], a comparison value per column drawn as a sindoor tick across it,
  // named once in a key line above the plot (spec.markLabel); spec.markName prefixes its hover tip
  if (spec.marks) { const at = new Map(spec.marks.map(([d, v]) => [d, v]));
    P.forEach((p, i) => { const v = at.get(p.d); if (v == null) return; s += `<line x1="${r1(cx(i) - bw / 2 - 2)}" x2="${r1(cx(i) + bw / 2 + 2)}" y1="${r1(y(v))}" y2="${r1(y(v))}" stroke="${C.comp}" stroke-width="2.5" data-tip="${esc(tlabel(p.d, spec.freq) + ', ' + (spec.markName ?? spec.markLabel ?? '') + ': ' + num(v, { dp: spec.valueDp ?? 1, suffix: spec.unit?.suffix ?? '' }))}"/>`; });
    if (spec.markLabel) s += `<path d="M${r1(G)},10.5H${r1(G + 16)}" stroke="${C.comp}" stroke-width="2.5"/>` + T(G + 22, 14, spec.markLabel, { size: 12, fill: C.ink2 }); }
  // label the latest column and any events
  const L = P.at(-1);
  if (L.v != null && spec.highlight !== 'none') {
    // a comparison tick on the latest column (spec.marks) beyond its end: the label clears the tick too
    const lm = spec.marks?.find(([d]) => d === L.d)?.[1], ev = lm != null && (L.v >= 0 ? lm > L.v : lm < L.v) ? lm : L.v;
    let ly = L.v >= 0 ? y(ev) - 7 : y(ev) + 16;
    if (spec.marks && L.v >= 0) { // and clears the ticks of the columns its text reaches over
      const lw = tw(num(L.v, { dp: spec.valueDp ?? 1, suffix: spec.unit?.suffix ?? '' }), 13, 600), lx1 = cx(n - 1) + bw / 2;
      for (const [d, v] of spec.marks) { const i = P.findIndex(p => p.d === d); if (i < 0 || v == null || cx(i) + bw / 2 + 2 < lx1 - lw) continue; if (y(v) > ly - 13 && y(v) < ly + 5) ly = y(v) - 7; }
    }
    // optional (external port): spec.fmt(v), the guide's own renderer for the latest label and the tips ("−$4.2 bn")
    s += T(cx(n - 1) + bw / 2, ly, spec.fmt ? spec.fmt(L.v) : num(L.v, { dp: spec.valueDp ?? 1, sign: !!spec.sign, suffix: spec.unit?.suffix ?? '' }), { size: 13, fill: C.ink, weight: 600, anchor: 'end', cls: 'tab halo' });
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
// optional (2026-10-17): spec.pair:{a, b, aColor?, bColor?}, the mark drawn as a second, thinner bar under
// each row's bar (then and now, exports and imports) with its own value, and a key of the two at the top;
// spec.sortBy:'mark' ranks by the second value
function _bars(spec) {
  const W = spec.width, phone = W < 560, PR = spec.pair;
  let rows = spec.rows.filter(r => r.value != null);
  if (spec.sort !== false) rows = rows.slice().sort((a, b) => spec.sortBy === 'mark' ? (b.mark ?? -Infinity) - (a.mark ?? -Infinity) : b.value - a.value);
  const vals = rows.map(r => r.value);
  // optional: row.mark, a second value drawn as a hollow circle on the bar's line (a year earlier,
  // a share of accounts); the bar's value label steps past the circle when it would sit on it.
  // spec.markFmt labels the circle itself, quietly, when it lies clear beyond the bar's label and the
  // label fits (no width is reserved for it).
  const marks = rows.map(r => r.mark).filter(v => v != null);
  // optional (health-gender port): spec.dots with spec.from, a dot plot for measures whose zero
  // means nothing (girls per 1,000 boys, age at marriage): a dot at each value on a scale from
  // spec.from, never a bar cut short of zero
  const lo = spec.dots ? spec.from : Math.min(0, ...vals, ...marks), hi = Math.max(0, ...vals, ...marks, spec.ref?.value ?? 0, spec.max ?? 0); // spec.max: a shared upper bound (two panels on one scale)
  const fmt = spec.fmt ?? (v => num(v, { dp: spec.dp ?? 1, sign: !!spec.sign, prefix: spec.unit?.prefix ?? '', suffix: spec.unit?.suffix ?? '' }));
  // optional: spec.fmt (v => label text, for mixed units such as MW below 1 GW), spec.sign (+ on rises), row.note (a second, quieter figure after the value),
  // spec.refFill:false (the ref is drawn but bars keep their highlight colouring)
  const noteW = r => r.note ? tw(r.note, 12) + 10 : 0;
  const valW = Math.max(...rows.map(r => tw(fmt(r.value), 12.5, 500) + noteW(r) + (r.mark != null ? 10 : 0)),
    0) + 8;
  // optional: spec.nameMax, a wider name column for long names (industries), default 200
  const nameW = phone ? 0 : Math.min(spec.nameMax ?? 200, Math.max(...rows.map(r => tw(r.name, 13, r.highlight ? 600 : 400))) + 14);
  const bh = phone ? 10 : PR ? 12 : 13, bh2 = phone ? 6 : 7, row = (phone ? 36 : 25) + (PR ? (phone ? 10 : 8) : 0), top = (spec.ref ? 54 : phone && !spec.dots ? 14 : 34) + (PR ? 22 : 0); // a phone draws no scale: no room kept for one
  const x0 = nameW + (lo < 0 ? valW : 0) + (phone && marks.length && !PR ? 5 : 0); // a phone's names sit at the edge: a circle near zero keeps its whole ring inside
  // the scale is fitted so each bar and its own label end inside the drawing (the widest label no longer
  // reserves a column beside every bar; 2026-10-17); negative values, log scales and shared bounds keep
  // the reserved column
  let x1 = W - valW;
  if (lo >= 0 && !spec.log && spec.max == null) {
    const lw = (r, v) => tw(fmt(v), 12.5, r.highlight ? 600 : 400) + noteW(r) + 3;
    let k = Infinity;
    for (const r of rows) {
      const need = [[r.value, (spec.dots ? 9 : 5) + lw(r, r.value)]];
      if (r.mark != null) need.push(PR ? [r.mark, 5 + tw(fmt(r.mark), 11.5) + 3] : [Math.max(r.value, r.mark), 10 + lw(r, r.value)]);
      for (const [v, pad] of need) if (v > lo) k = Math.min(k, (W - x0 - pad) / (v - lo));
    }
    if (isFinite(k) && k > 0) x1 = Math.max(W - valW, Math.min(W - 4, x0 + k * (hi - lo)));
  }
  // optional (payments port): spec.log, a log scale for values that span powers of ten; bars
  // start at the power of ten below the smallest, gridlines at each power (label them with tickFmt)
  const LG = spec.log ? [Math.floor(Math.log10(Math.min(...vals)) + 1e-9), Math.ceil(Math.log10(Math.max(...vals)) - 1e-9)] : null;
  const x = LG ? (v => lin(LG[0], LG[1], x0, x1)(Math.log10(Math.max(v, 10 ** LG[0])))) : lin(lo, hi, x0, x1);
  const H = top + rows.length * row + 8;
  let s = svgOpen(W, H, spec.title);
  // a light scale at the top: three values, no gridlines through the names
  const N = LG ? { step: 1, ticks: Array.from({ length: LG[1] - LG[0] + 1 }, (_, i) => 10 ** (LG[0] + i)) } : nice(lo, hi, phone ? 3 : 4);
  const bands = phone ? rows.map((_, i) => { const yy = top + i * row + 18; return [yy - 3, yy + bh + 3]; }) : null;
  if (spec.band) { const a = x(Math.max(lo, spec.band.from)), b = x(Math.min(hi, spec.band.to)); if (b > a) s += `<rect x="${r1(a)}" y="${top - 8}" width="${r1(b - a)}" height="${r1(H - 6 - top + 8)}" fill="${C.leadWash}"/>`; }
  // every bar carries its value, so a phone keeps only the zero line; the scale is for desktop
  if (phone && !spec.dots) { if (lo < 0) s += rowRules(x(0), 0, 0, bands, C.base); } // all bars from one edge: the edge is the zero line (no stub per row) // a phone shows no scale, so a dot plot's stems (from spec.from, not zero) are left off there
  else for (const v of N.ticks) { if (!LG && (v < lo - 1e-9 || v > hi + 1e-9)) continue; s += Lv(x(v), top - 8, H - 6, v === 0 ? C.base : C.grid); s += T(x(v), top - 14, spec.tickFmt ? spec.tickFmt(v) : num(v, { dp: dpOf(N.step), suffix: v === N.ticks.filter(t => t <= hi).at(-1) ? spec.unit?.suffix ?? '' : '' }), { size: 12, fill: C.muted, anchor: 'middle', cls: 'tab' }); }
  if (spec.ref) { // the rule runs row by row and stops short of any value label it would strike
    const rx = x(spec.ref.value);
    s += T(rx, top - 30, spec.ref.label, { size: 12, fill: C.ink, weight: 600, anchor: 'middle' });
    s += Lv(rx, top - 24, top - 4, C.ink, 1);
    rows.forEach((r, i) => {
      const y0 = top + i * row, yy = y0 + (phone ? 18 : (row - bh) / 2);
      const end = r.value < 0 ? x(Math.min(0, r.value)) - 5 : x(Math.max(0, r.value)) + 5, w = tw(fmt(r.value), 12.5, 500) + noteW(r);
      const [a, b] = r.value < 0 ? [end - w - 3, end + 2] : [end - 2, end + w + 3];
      const hits = rx > a && rx < b;
      const dsh = spec.ref.dash ?? ''; // optional: ref.dash, a dotted or dashed rule (a median)
      if (phone) { if (!hits) s += Lv(rx, yy - 3, yy + bh + 3, C.ink, 1, dsh); }
      else if (!hits) s += Lv(rx, y0, y0 + row, C.ink, 1, dsh);
      else { s += Lv(rx, y0, yy - 1, C.ink, 1, dsh); s += Lv(rx, yy + bh + 1, y0 + row, C.ink, 1, dsh); }
    });
  }
  if (PR) { // the key: a swatch of each bar and its name, above the scale
    const ca = PR.aColor ?? C.lead, cb = PR.bColor ?? C.ctx2, kx = x0, kb = kx + 20 + tw(PR.a, 12.5) + 18;
    s += `<rect x="${kx}" y="7" width="14" height="${bh}" fill="${ca}"/>` + T(kx + 20, 16, PR.a, { size: 12.5, fill: C.ink2 });
    s += `<rect x="${r1(kb)}" y="9" width="14" height="${bh2}" fill="${cb}"/>` + T(kb + 20, 16, PR.b, { size: 12.5, fill: C.ink2 });
  }
  rows.forEach((r, i) => {
    const yy = top + i * row + (phone ? 18 : (row - bh - (PR ? bh2 + 3 : 0)) / 2);
    const a = x(Math.min(0, r.value)), b = x(Math.max(0, r.value));
    const above = spec.ref && spec.refFill !== false ? r.value > spec.ref.value : r.highlight;
    if (PR) {
      const fa = PR.aColor ?? r.color ?? (r.highlight ? C.lead : C.leadTint), fb = PR.bColor ?? C.ctx2, y2 = yy + bh + (phone ? 4 : 3);
      if (phone) s += T(x0, yy - 5, r.name, { size: 12.5, fill: C.ink, weight: r.highlight ? 600 : 400 });
      else s += T(nameW - 12, yy + (bh + 3 + bh2) / 2 + 4.5, r.name, { size: 13, fill: C.ink, weight: r.highlight ? 600 : 400, anchor: 'end' });
      s += `<rect x="${r1(a)}" y="${r1(yy)}" width="${r1(Math.max(1, b - a))}" height="${bh}" fill="${fa}" data-tip="${esc(r.name + ', ' + PR.a + ': ' + fmt(r.value))}"/>`;
      s += T(b + 5, yy + bh / 2 + 4.5, fmt(r.value), { size: 12.5, fill: r.highlight ? C.ink : C.ink2, weight: r.highlight ? 600 : 400, cls: 'tab halo' });
      if (r.mark != null) { const bm = x(Math.max(0, r.mark));
        s += `<rect x="${r1(x(0))}" y="${r1(y2)}" width="${r1(Math.max(1, bm - x(0)))}" height="${bh2}" fill="${fb}" data-tip="${esc(r.name + ', ' + PR.b + ': ' + fmt(r.mark))}"/>`;
        s += T(bm + 5, y2 + bh2 / 2 + 4, fmt(r.mark), { size: 11.5, fill: C.muted, cls: 'tab halo' }); }
      return;
    }
    const fill = r.color ?? (above || r.highlight ? (r.value < 0 ? C.comp : C.lead) : r.value < 0 ? C.compTint : C.leadTint); // r.color: a row's own fill (a group's colour)
    if (phone) s += T(x0, yy - 5, r.name, { size: 12.5, fill: C.ink, weight: r.highlight ? 600 : 400 });
    else s += T(nameW - 12, yy + bh / 2 + 4.5, r.name, { size: 13, fill: C.ink, weight: r.highlight ? 600 : 400, anchor: 'end' });
    if (spec.dots) s += (phone ? '' : `<line x1="${r1(x(lo))}" x2="${r1(b)}" y1="${r1(yy + bh / 2)}" y2="${r1(yy + bh / 2)}" stroke="${C.ctx2}" stroke-width="1.5"/>`) + `<circle cx="${r1(b)}" cy="${r1(yy + bh / 2)}" r="5" fill="${fill}" stroke="#fff" stroke-width="1.5" data-tip="${esc(r.name + ': ' + fmt(r.value))}"/>`;
    else s += `<rect x="${r1(a)}" y="${r1(yy)}" width="${r1(Math.max(1, b - a))}" height="${bh}" fill="${fill}" data-tip="${esc(r.name + ': ' + fmt(r.value))}"/>`;
    let vx = r.value < 0 ? a - 5 : b + (spec.dots ? 9 : 5), inside = false;
    if (r.mark != null) {
      // a circle where the label would go: the label moves inside the bar's end when the bar is
      // long enough (so it still reads as the bar's), else past the circle
      const xm = x(r.mark), lw = tw(fmt(r.value), 12.5, r.highlight ? 600 : 400) + noteW(r);
      if (r.value >= 0 ? xm >= b - 6 && xm <= vx + lw + 6 : xm <= a + 6 && xm >= vx - lw - 6) {
        if (!phone && r.value >= 0 && !r.note && xm >= b - 2 && b - a > lw + 14) { inside = true; vx = Math.min(b - 5, xm - 9); } // ends clear of the ring (ilo port)
        else vx = r.value < 0 ? xm - 10 : xm + 10;
      }
      s += `<circle cx="${r1(xm)}" cy="${r1(yy + bh / 2)}" r="4" fill="#fff" stroke="${C.ink2}" stroke-width="1.5" data-tip="${esc(r.name + ': ' + (spec.markFmt ? spec.markFmt(r.mark) : (spec.markName ? spec.markName + ' ' : '') + fmt(r.mark)))}"/>`;
      if (spec.markFmt && r.value >= 0 && xm > (inside ? b : vx + lw) + 14) { // right of the circle if it fits, else left of it, else none
        const mt = spec.markFmt(r.mark), mw = tw(mt, 11.5), free = (inside ? b : vx + lw) + 8;
        if (xm + 9 + mw <= W) s += T(xm + 9, yy + bh / 2 + 4.5, mt, { size: 11.5, fill: C.muted, cls: 'tab halo' });
        else if (xm - 9 - mw >= free) s += T(xm - 9, yy + bh / 2 + 4.5, mt, { size: 11.5, fill: C.muted, anchor: 'end', cls: 'tab halo' });
      }
    }
    if (inside) s += T(vx, yy + bh / 2 + 4.5, fmt(r.value), { size: 12.5, fill: fill === C.lead || fill === C.comp ? '#fff' : C.ink, weight: r.highlight ? 600 : 500, anchor: 'end', cls: 'tab' });
    else s += T(vx, yy + bh / 2 + 4.5, fmt(r.value), { size: 12.5, fill: r.highlight ? C.ink : C.ink2, weight: r.highlight ? 600 : 400, anchor: r.value < 0 ? 'end' : 'start', cls: 'tab halo' });
    if (r.note) { const vw = tw(fmt(r.value), 12.5, r.highlight ? 600 : 400) + 10; s += T(r.value < 0 ? vx - vw : vx + vw, yy + bh / 2 + 4.5, r.note, { size: 12, fill: C.muted, anchor: r.value < 0 ? 'end' : 'start', cls: 'tab' }); }
  });
  return s + '</svg>';
}

// ============================================================================ DUMBBELL
// spec: { width, rows:[{name,a,b,highlight?}], keys:{a:'Rural',b:'Urban'}, unit, dp, sortBy:'b'|'a'|'gap' }
export const dumbbell = (spec) => finish(_dumbbell(spec));
function _dumbbell(spec) {
  const W = spec.width, phone = W < 560;
  const k = spec.sortBy ?? 'b';
  // optional (aishe port): sortBy:'none' keeps the given order; spec.aColor (the a dot's ring,
  // default sindoor; C.ink2 for a grey context group); spec.labelAll (values on every row)
  const rows = spec.rows.slice().sort((p, q) => k === 'none' ? 0 : k === 'gap' ? (q.b - q.a) - (p.b - p.a) : q[k] - p[k]);
  // optional (health-gender port): a row whose a is null (no earlier round) shows its b dot alone;
  // row.label:true puts values on that row as on the first
  // optional (consumption port): spec.refs:[{value,label,side:'left'|'right'}], several benchmark rules (rural and
  // urban means); r.a0/r.b0, the earlier round as small pale dots; r.bColor, a row's own b fill (a sector);
  // spec.from, the scale's lower end when zero means nothing (a Gini)
  const REFS = spec.refs ?? [];
  const vals = rows.flatMap(r => [r.a, r.b, r.m, r.a0, r.b0]).concat(spec.ref ? [spec.ref.value] : [], REFS.map(f => f.value)).filter(v => v != null);
  const N = nice(spec.from ?? Math.min(0, ...vals), Math.max(...vals), phone ? 3 : 5);
  // optional (survey port): spec.nameMax, a wider name column for long names (default 190), so they stay on one line
  const nameW = phone ? 0 : Math.min(spec.nameMax ?? 190, Math.max(...rows.map(r => tw(r.name, 13, r.highlight ? 600 : 400))) + 14);
  rows.forEach(r => { r._lines = phone ? [r.name] : wrap(r.name, nameW - 14, 13, r.highlight ? 600 : 400, 2); });
  const row = phone ? 34 : 24, top = spec.ref || REFS.length ? 70 : 52, H = top + rows.length * row + 10; // a ref label takes its own row under the key
  // optional (banks port): spec.endText(r), one label per row in place of the values, after the
  // right-hand dot (on a phone, at the right end of the name line); spec.room, px kept clear at the right
  const x = lin(N.lo, N.hi, nameW + 6, W - (spec.room ?? (spec.endCol ? 72 : 40))); // optional (jobs port): spec.endCol, endText set as a right-hand column
  const fmt = spec.fmt ?? (v => num(v, { dp: spec.dp ?? 1 })), aCol = spec.aColor ?? C.comp; // spec.fmt(v): the value labels and tips
  let s = svgOpen(W, H, spec.title);
  const dbands = phone ? rows.map((_, i) => { const yy = top + i * row + 22; return [yy - 7, yy + 7]; }) : null;
  if (spec.band) { const a = x(Math.max(N.lo, spec.band.from)), b = x(Math.min(N.hi, spec.band.to)); if (b > a) s += `<rect x="${r1(a)}" y="${top - 10}" width="${r1(b - a)}" height="${r1(H - 6 - top + 10)}" fill="${C.leadWash}"/>`; }
  for (const v of N.ticks) { s += rowRules(x(v), top - 10, H - 6, dbands, v === 0 ? C.base : C.grid); s += T(x(v), top - 16, num(v, { dp: dpOf(N.step), suffix: v === N.ticks.at(-1) ? spec.unit?.suffix ?? '' : '' }), { size: 12, fill: C.muted, anchor: v === N.lo && phone ? 'start' : 'middle', cls: 'tab' }); }
  // ref: { value, label }, a dotted rule for a benchmark (an all-units figure), labelled at the right of the key row
  if (spec.ref) { const rx = x(spec.ref.value); s += rowRules(rx, top - 6, H - 6, dbands, C.ink, 1, ' stroke-dasharray="1 3" stroke-linecap="round"'); s += T(rx, top - 34, spec.ref.label, { size: 12, fill: C.ink, weight: 600, anchor: 'middle', cls: 'halo' }); }
  for (const f of REFS) { const rx = x(f.value); s += rowRules(rx, top - 6, H - 6, dbands, C.ink, 1, ' stroke-dasharray="1 3" stroke-linecap="round"');
    s += T(f.side === 'left' ? rx - 6 : f.side === 'right' ? rx + 6 : rx, top - 34, f.label, { size: 12, fill: C.ink, weight: 600, anchor: f.side === 'left' ? 'end' : f.side === 'right' ? 'start' : 'middle', cls: 'halo' }); }
  // key: swatches above the scale
  const ka = spec.keys.a, kb = spec.keys.b;
  s += (spec.mid ? `<path d="M${nameW + 7},12H${nameW + 17}" stroke="${C.leadTint}" stroke-width="5" stroke-linecap="round"/>` : `<circle cx="${nameW + 12}" cy="12" r="4.5" fill="#fff" stroke="${aCol}" stroke-width="2"/>`) + T(nameW + 22, 16, ka, { size: 12.5, fill: C.ink2 });
  const kx = nameW + 34 + tw(ka, 12.5);
  s += `<circle cx="${kx}" cy="12" r="4.5" fill="${C.lead}"/>` + T(kx + 10, 16, kb, { size: 12.5, fill: C.ink2 });
  rows.forEach((r, i) => {
    const yy = top + i * row + (phone ? 22 : row / 2);
    if (r.highlight) s += `<rect x="0" y="${r1(yy - row / 2 + (phone ? -10 : 0))}" width="${W}" height="${row}" fill="${C.wash}"/>`;
    if (phone) s += T(x(N.lo), yy - 10, r.name, { size: 12.5, fill: C.ink, weight: r.highlight ? 600 : 400, cls: 'halo' });
    else r._lines.forEach((ln, k) => { s += T(nameW - 12, yy + 4.5 + (k - (r._lines.length - 1) / 2) * 13, ln, { size: r._lines.length > 1 ? 12 : 13, fill: C.ink, weight: r.highlight ? 600 : 400, anchor: 'end' }); });
    if (spec.mid) { // optional (climate port): spec.mid, each row a range a..b (a quiet bar) and its median r.m (the dot), labelled right of the range
      const xa = x(r.a), xb = x(r.b), xm = x(r.m), tip = esc(r.name + ' · ' + kb + ': ' + fmt(r.m) + (spec.unit?.suffix ?? '') + '; ' + ka + ': ' + fmt(r.a) + ' to ' + fmt(r.b));
      s += `<line x1="${r1(xa)}" x2="${r1(xb)}" y1="${r1(yy)}" y2="${r1(yy)}" stroke="${C.leadTint}" stroke-width="5" stroke-linecap="round"/>`;
      s += `<circle cx="${r1(xm)}" cy="${r1(yy)}" r="4.75" fill="${C.lead}" stroke="#fff" stroke-width="1.5" data-tip="${tip}"/>`;
      s += T(Math.max(xa, xb) + 9, yy + 4.5, fmt(r.m), { size: 12, fill: C.ink, weight: r.highlight ? 600 : 500, cls: 'tab' });
      return;
    }
    const xa = x(r.a), xb = x(r.b);
    const odd = spec.flagWhen ? spec.flagWhen(r) : false;
    if (r.a != null) s += `<line x1="${r1(xa)}" x2="${r1(xb)}" y1="${r1(yy)}" y2="${r1(yy)}" stroke="${odd ? C.compTint : C.ctx2}" stroke-width="${odd ? 3 : 2.5}"/>`;
    if (odd && spec.flagLabel && !phone) s += T(Math.max(xa, xb) + 10, yy + 4.5, spec.flagLabel, { size: 11.5, fill: C.comp });
    for (const [v0, k0] of [[r.a0, ka], [r.b0, kb]]) if (v0 != null) s += `<circle cx="${r1(x(v0))}" cy="${r1(yy)}" r="3" fill="${C.ctx2}" data-tip="${esc(r.name + ' · ' + k0 + ', earlier round: ' + fmt(v0) + (spec.unit?.suffix ?? ''))}"/>`;
    if (r.a != null) s += `<circle cx="${r1(xa)}" cy="${r1(yy)}" r="4.5" fill="#fff" stroke="${aCol}" stroke-width="2" data-tip="${esc(r.name + ' · ' + ka + ': ' + fmt(r.a) + (spec.unit?.suffix ?? ''))}"/>`;
    s += `<circle cx="${r1(xb)}" cy="${r1(yy)}" r="4.75" fill="${r.bColor ?? C.lead}" stroke="#fff" stroke-width="1.5" data-tip="${esc(r.name + ' · ' + kb + ': ' + fmt(r.b) + (spec.unit?.suffix ?? ''))}"/>`;
    if (spec.endText) s += phone ? T(W, yy - 10, spec.endText(r), { size: 12, fill: C.ink2, anchor: 'end', cls: 'tab halo' })
      : spec.endCol ? T(W, yy + 4.5, spec.endText(r), { size: 12.5, fill: r.highlight ? C.ink : C.ink2, weight: r.highlight ? 600 : 400, anchor: 'end', cls: 'tab' })
      : T((r.a == null ? xb : Math.max(xa, xb)) + 9, yy + 4.5, spec.endText(r), { size: 12, fill: C.ink, cls: 'tab' });
    else if ((i === 0 || r.highlight || spec.labelAll || r.label) && r.a == null) s += T(xb + 9, yy + 4.5, fmt(r.b), { size: 12, fill: C.ink, weight: 600, cls: 'tab' });
    else if (i === 0 || r.highlight || spec.labelAll || r.label) { // values outside the pair, never between the dots
      const ex = [r.a0, r.b0].filter(v => v != null).map(v => x(v)); // labels step past any earlier-round dots
      const [lx, rx] = (([p, q]) => [Math.min(p, ...ex), Math.max(q, ...ex)])(xa < xb ? [xa, xb] : [xb, xa]), [lv, rv] = xa < xb ? [r.a, r.b] : [r.b, r.a];
      if (lx - 9 - tw(fmt(lv), 12) >= (phone ? 0 : nameW)) s += T(lx - 9, yy + 4.5, fmt(lv), { size: 12, fill: C.ink2, anchor: 'end', cls: 'tab' }); // no room left of the pair: the tip carries it
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
  // optional (gdp port): spec.shared:false (each panel on its own scale, labelled on its own
  // gridlines), panel.sub (a quieter line under the name), panel.lines:[{data, role}] (several
  // series in one panel, e.g. rulers never joined; the header quotes the last), spec.tFmt(d)
  // (the date under the value and at the panel ends), spec.key:[{name, role}] (one row above)
  const own = spec.shared === false, linesOf = p => p.lines ?? [{ data: p.data }];
  const anyLines = spec.panels.some(p => p.lines), anySub = spec.panels.some(p => p.sub);
  const keyAt = []; { let kx = 0, ky = 0; for (const k of spec.key ?? []) { const kw = 24 + tw(k.name, 12); if (kx && kx + kw > W) { kx = 0; ky += 20; } keyAt.push([kx, ky]); kx += kw + 22; } } // the key wraps on a phone
  const keyH = spec.key ? 28 + (keyAt.at(-1)?.[1] ?? 0) : 0;
  // optional (farms port): spec.ph, the panels' plot height (default 70); panel.open:[[d,v]], points on
  // another ruler (an advance estimate) drawn as hollow rings, never joined to the line
  const gx = 24, pw = (W - gx * (cols - 1)) / cols, ph = spec.ph ?? 70, head = anySub ? 66 : 52, foot = 6, gy = 22;
  const P = spec.panels, openV = p => (p.open ?? []).map(d => d[1]);
  const vals = P.flatMap(p => linesOf(p).flatMap(l => l.data.map(d => d[1])).concat(openV(p)).filter(v => v != null));
  // shared scale; outliers beyond the fence are clipped and said so
  const sorted = vals.slice().sort((a, b) => a - b), q = f => sorted[Math.floor(f * (sorted.length - 1))];
  const fence = q(0.75) + 3 * (q(0.75) - q(0.25));
  const hiV = Math.max(...vals.filter(v => v <= fence)), loV = Math.min(0, ...vals);
  // optional (industry port): spec.domain:{lo,hi,ticks}, a fixed shared scale; values beyond it
  // on either side are clipped and said so (the lockdown prints of a y/y grid)
  const N = spec.domain ? { ...spec.domain, step: spec.domain.ticks[1] - spec.domain.ticks[0] } : nice(loV, hiV, 3);
  const rowsN = Math.ceil(P.length / cols), H = keyH + rowsN * (head + ph + foot + 18) + (rowsN - 1) * gy;
  let s = svgOpen(W, H, spec.title);
  const ends = anyLines ? P.flatMap(p => linesOf(p).flatMap(l => [l.data[0][0], l.data.at(-1)[0]])).sort() : null;
  const D0 = anyLines ? ends[0] : P[0].data[0][0], D1 = anyLines ? ends.at(-1) : P[0].data.at(-1)[0];
  const t0 = tnum(D0), t1 = tnum(D1);
  const G0 = gutterFor(N.ticks, spec.unit, dpOf(N.step)) - 2;
  const roleCol = { lead: C.lead, comp: C.comp, ctx: C.ctx, ctx2: C.ctx2, ink: C.ink2 };
  if (spec.key) spec.key.forEach((k, i) => { const [kx, ky] = keyAt[i]; s += `<path d="M${kx},${10 + ky}H${kx + 18}" stroke="${roleCol[k.role] ?? C.ink2}" stroke-width="2"/>` + T(kx + 24, 14 + ky, k.name, { size: 12, fill: C.ink2 }); });
  P.forEach((p, i) => {
    const c = i % cols, r = Math.floor(i / cols);
    const ox = c * (pw + gx), oy = keyH + r * (head + ph + foot + 18 + gy);
    const pv = own ? linesOf(p).flatMap(l => l.data.map(d => d[1])).concat(openV(p)).filter(v => v != null) : null;
    const NP = own ? (p.domain ? { ...p.domain, step: p.domain.ticks[1] - p.domain.ticks[0] } : nice(Math.min(0, ...pv), Math.max(0, ...pv), 3)) : N, G = own ? gutterFor(NP.ticks, p.unit ?? spec.unit, dpOf(NP.step)) - 2 : G0; // panel.domain (jobs port): a panel's own fixed scale
    const x = lin(t0, t1, ox + G, ox + pw - 4), y = lin(NP.lo, NP.hi, oy + head + ph, oy + head);
    const last = linesOf(p).at(-1).data.filter(d => d[1] != null).at(-1);
    // optional (payments port): panel.vText, the header value as the guide writes it; panel.unit, the
    // panel's own tick unit (each panel on its own scale and in its own unit, with shared:false)
    const lines = wrap(p.name, p.vText ? Math.min(pw - 52, pw - tw(p.vText, 13, 600) - 12) : pw - 52, 12.5, p.highlight ? 600 : 500, 2);
    if (spec.fy && last) { const yr = last[0].slice(0, 4); s += T(ox + pw, oy + 28, `${yr}-${String(+yr.slice(2) + 1).padStart(2, '0')}`, { size: 11, fill: C.muted, anchor: 'end' }); }
    else if (spec.tFmt && last) s += T(ox + pw, oy + 28, spec.tFmt(last[0]), { size: 11, fill: C.muted, anchor: 'end' });
    lines.forEach((ln, k) => { s += T(ox, oy + 13 + k * 15, ln, { size: 12.5, fill: C.ink, weight: 500 }); });
    if (p.sub) { const dw = spec.tFmt && last && lines.length < 2 ? tw(spec.tFmt(last[0]), 11) + 12 : 0;
      wrap(p.sub, pw - dw, 11.5, 400, 2).forEach((ln, k) => { s += T(ox, oy + 13 + lines.length * 15 + k * 14, ln, { size: 11.5, fill: C.muted }); }); }
    // optional (cpi port): spec.boldHighlight, only highlighted panels' values set bold (the rest ink2)
    const quiet = spec.boldHighlight && !(p.bold ?? p.highlight); // panel.bold: bold without the lead line
    s += T(ox + pw, oy + 13, p.vText ? p.vText : spec.vFmt ? spec.vFmt(last[1]) : num(last[1], { dp: 1, suffix: spec.unit?.suffix ?? '' }), { size: 13, fill: quiet ? C.ink2 : C.ink, weight: quiet ? 400 : 600, anchor: 'end', cls: 'tab' }); // optional (aishe port): spec.vFmt(v), the header value
    // optional (cpi port): spec.band:{from,to}, a wash across each panel (a policy band, drawn to the panel's scale)
    if (spec.band) { const b0 = y(Math.min(NP.hi, spec.band.to)), b1 = y(Math.max(NP.lo, spec.band.from)); if (b1 > b0) s += `<rect x="${r1(ox + G)}" y="${r1(b0)}" width="${r1(pw - G)}" height="${r1(b1 - b0)}" fill="${C.leadWash}"/>`; }
    for (const v of NP.ticks) {
      s += Lh(ox + G, ox + pw, y(v), v === 0 ? C.base : C.grid, 1);
      s += T(ox, y(v) + 4, num(v, { dp: dpOf(NP.step), suffix: v === NP.ticks.at(-1) ? (p.unit ?? spec.unit)?.suffix ?? '' : '' }), { size: 11, fill: c === 0 || own ? C.muted : C.faint, cls: 'tab' });
    }
    // optional (jobs port): spec.seamAt, a date where the instrument changed, a dashed hairline in every panel
    if (spec.seamAt) s += Lv(x(tnum(spec.seamAt)), oy + head - 4, oy + head + ph, C.faint, 1, '3 3');
    if (p.lines) { // each series its own path, broken at every null: rulers are never joined
      for (const l of p.lines) { let d = '', pen = false;
        for (const [dd, v] of l.data) { if (v == null) { pen = false; continue; } d += `${pen ? 'L' : 'M'}${r1(x(tnum(dd)))},${r1(y(v))}`; pen = true; }
        if (d) s += `<path d="${d}" fill="none" stroke="${roleCol[l.role] ?? C.ink2}" stroke-width="${l.role === 'lead' || l.role === 'ink' ? 2 : 1.5}" stroke-linejoin="round" stroke-linecap="round"/>`; }
      const lc = roleCol[p.lines.at(-1).role] ?? C.ink2;
      s += `<circle cx="${r1(x(tnum(last[0])))}" cy="${r1(y(last[1]))}" r="3" fill="${lc}" stroke="#fff" stroke-width="1.5" data-tip="${esc(p.name + ', ' + (spec.tFmt ? spec.tFmt(last[0]) : last[0]) + ': ' + num(last[1], { dp: 1, suffix: spec.unit?.suffix ?? '' }))}"/>`;
      if (r === rowsN - 1 || i + cols >= P.length) {
        const lab = d => spec.tFmt ? spec.tFmt(d) : tlabel(d).replace(' 20', " ’");
        s += T(ox, oy + head + ph + 17, lab(D0), { size: 11, fill: C.muted });
        s += T(ox + pw, oy + head + ph + 17, lab(D1), { size: 11, fill: C.muted, anchor: 'end' });
      }
      return;
    }
    if (spec.ref) {
      let d = ''; spec.ref.data.forEach(([dd, v], k) => { if (v != null) d += `${d ? 'L' : 'M'}${r1(x(tnum(dd)))},${r1(y(Math.min(v, N.hi)))}`; });
      s += `<path d="${d}" fill="none" stroke="${C.ctx}" stroke-width="1.25" stroke-dasharray="2 2.5"/>`;
    }
    let d = '', clipped = false;
    let pen = false; // a null breaks the line: missing is a gap, never joined across
    let under = false;
    p.data.forEach(([dd, v]) => { if (v == null) { pen = false; return; } if (v > NP.hi) clipped = true; if (v < NP.lo) under = true; d += `${pen ? 'L' : 'M'}${r1(x(tnum(dd)))},${r1(y(spec.domain ? Math.max(NP.lo, Math.min(v, NP.hi)) : Math.min(v, NP.hi)))}`; pen = true; });
    const col = p.highlight ? C.lead : C.ink2;
    s += `<path d="${d}" fill="none" stroke="${col}" stroke-width="${p.highlight ? 2 : 1.5}" stroke-linejoin="round" stroke-linecap="round"/>`;
    s += `<circle cx="${r1(x(tnum(last[0])))}" cy="${r1(y(spec.domain ? Math.max(NP.lo, Math.min(last[1], NP.hi)) : Math.min(last[1], NP.hi)))}" r="3" fill="${col}" stroke="#fff" stroke-width="1.5"${spec.tFmt ? ` data-tip="${esc(p.name + ', ' + spec.tFmt(last[0]) + ': ' + num(last[1], { dp: 1, suffix: spec.unit?.suffix ?? '' }))}"` : ''}/>`;
    for (const [dd, v] of p.open ?? []) if (v != null) s += `<circle cx="${r1(x(tnum(dd)))}" cy="${r1(y(Math.min(v, NP.hi)))}" r="3.25" fill="#fff" stroke="${col}" stroke-width="1.5" data-tip="${esc(p.name + (p.openName ? ', ' + p.openName : '') + ': ' + (spec.vFmt ? spec.vFmt(v) : num(v, { dp: 1, suffix: spec.unit?.suffix ?? '' })))}"/>`;
    if (clipped || (under && spec.domain)) s += T(ox + pw, oy + 28, `off the scale ${clipped && under ? '↑↓' : clipped ? '↑' : '↓'}`, { size: 11, fill: C.muted, anchor: 'end' });
    if (r === rowsN - 1 || i + cols >= P.length) {
      const lab = d => spec.fy ? `${d.slice(0, 4)}-${String(+d.slice(2, 4) + 1).padStart(2, '0')}` : spec.tFmt ? spec.tFmt(d) : tlabel(d).replace(' 20', " ’");
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
  // optional (population port): spec.counts, values drawn as given (millions) rather than as shares; spec.unit.suffix on the scale, spec.tipUnit in tips
  const sh = (v, t) => v == null ? null : spec.counts ? v : v / t * 100;
  const pu = spec.counts ? spec.unit?.suffix ?? '' : '%', tu = spec.counts ? spec.tipUnit ?? '' : '% of the population';
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
  for (const v of N.ticks) { if (!v) continue; for (const sgn of [-1, 1]) { const xx = sgn < 0 ? mid - gap / 2 - xr(v) : mid + gap / 2 + xr(v); s += Lv(xx, top - 4, H - 24, C.grid); s += T(xx, H - 8, num(v, { dp: dpOf(N.step), suffix: pu }), { size: 11, fill: C.muted, anchor: 'middle', cls: 'tab' }); } }
  rows.forEach((r, i) => {
    const yy = top + i * row;
    if (r.m != null) s += `<rect x="${r1(mid - gap / 2 - xr(r.m))}" y="${yy}" width="${r1(xr(r.m))}" height="${bh}" fill="${C.leadTint}" data-tip="${esc(`Men ${r.g}: ${num(r.m, { dp: 1 })}${tu}`)}"/>`;
    if (r.f != null) s += `<rect x="${r1(mid + gap / 2)}" y="${yy}" width="${r1(xr(r.f))}" height="${bh}" fill="${C.compTint}" data-tip="${esc(`Women ${r.g}: ${num(r.f, { dp: 1 })}${tu}`)}"/>`;
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
  // optional (industry port): spec.medians:false drops the crosshairs; spec.diag:{label}, the line
  // where y equals x (equal shares), labelled above its upper end
  if (spec.medians !== false) {
  s += Lv(x(mx), top, H - bottom, C.ctx2, 1, '2 3') + Lh(G, W - right, y(my), C.ctx2, 1).replace('/>', ' stroke-dasharray="2 3"/>');
  s += T(x(mx) + 4, H - bottom - 6, 'median', { size: 11, fill: C.muted, cls: 'halo' }) + T(W - right, y(my) - 5, 'median', { size: 11, fill: C.muted, anchor: 'end', cls: 'halo' });
  }
  const diagBox = [];
  if (spec.diag) { const a = Math.max(NX.lo, NY.lo), e = Math.min(NX.hi, NY.hi);
    s += `<line x1="${r1(x(a))}" x2="${r1(x(e))}" y1="${r1(y(a))}" y2="${r1(y(e))}" stroke="${C.ctx}" stroke-width="1" stroke-dasharray="3 3"/>`;
    if (spec.diag.label) { const w = tw(spec.diag.label, 11.5); s += T(x(e) - 8, y(e) - 8, spec.diag.label, { size: 11.5, fill: C.muted, anchor: 'end', cls: 'halo' }); diagBox.push({ x0: x(e) - 10 - w, x1: x(e) - 6, y0: y(e) - 19, y1: y(e) - 4 }); } }
  for (const p of P) s += `<circle cx="${r1(x(p.x))}" cy="${r1(y(p.y))}" r="${p.highlight ? 5.5 : 4.75}" fill="${p.color ?? C.lead}" fill-opacity="${p.highlight ? 1 : 0.62}" stroke="#fff" stroke-width="1.5" data-tip="${esc(p.name + ': ' + (spec.xFmt ? spec.xFmt(p.x) : num(p.x)) + ', ' + num(p.y, { dp: 1, suffix: spec.yUnit?.suffix ?? '' }))}"/>`;
  // labels: chosen points, placed to the side with more room, nudged apart
  const want = P.filter(p => (spec.label ?? []).includes(p.name) || p.highlight);
  // each label tries eight spots around its dot and takes the one furthest from every other
  // dot and every placed label; a leader is drawn when it had to move off the dot's side
  const dots = P.map(p => ({ x: x(p.x), y: y(p.y), r: 6 })), placed = [];
  placed.push(...diagBox);
  if (spec.medians !== false) { const mw = tw('median', 11); placed.push({ x0: x(mx) + 2, x1: x(mx) + 6 + mw, y0: H - bottom - 16, y1: H - bottom - 2 }, { x0: W - right - mw - 2, x1: W - right, y0: y(my) - 15, y1: y(my) - 2 }); } // (farms port) labels keep clear of the two median labels
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
  const fillOf = (v, j) => {
    if (v == null) return null;
    if (spec.fillAt) return spec.fillAt(v, j); // optional (consumption port): spec.fillAt(v, j), a shade per column (columns on their own scales)
    if (spec.fill) return spec.fill(v); // optional (rates port): spec.fill(v), categorical cells (a vote with or against)
    if (mid == null) { const k = Math.min(C.seq.length - 1, Math.floor((v - lo) / ((hi - lo) || 1) * C.seq.length)); return C.seq[k]; }
    const span = spec.span ?? (Math.max(hi - mid, mid - lo) || 1), t = (v - mid) / span; // -1..1, warm above the midpoint (spec.span: a fixed half-range, beyond it the end colours)
    const k = Math.round(3 - t * 3); return DIV[Math.max(0, Math.min(6, k))];
  };
  let s = svgOpen(W, H, spec.title);
  if (spec.legend) { const [l0, l1] = spec.legend, ramp = mid != null ? DIV.slice().reverse() : C.seq; s += T(0, 14, l0, { size: 12, fill: C.ink2 }); const lx = tw(l0, 12) + 10;
    ramp.forEach((c, i) => { s += `<rect x="${r1(lx + i * 22)}" y="5" width="21" height="11" fill="${c}"/>`; }); s += T(lx + ramp.length * 22 + 8, 14, l1, { size: 12, fill: C.ink2 }); }
  // optional (rates port): spec.key:[{label, color}], swatches for categorical cells, set above the column labels
  if (spec.key) { let kx = 0; for (const k of spec.key) { s += `<rect x="${r1(kx)}" y="5" width="11" height="11" fill="${k.color}"/>` + T(kx + 16, 14, k.label, { size: 12, fill: C.ink2 }); kx += 16 + tw(k.label, 12) + 18; } }
  // optional (climate port): spec.colShow(j, phone) picks which column labels to set (many narrow columns)
  // optional (farms port): spec.stagger, on a phone every column label is set, odd ones a line higher
  const stag = spec.stagger && phone;
  spec.cols.forEach((c, j) => { if (!stag && (spec.colShow ? !spec.colShow(j, phone) : phone && j % 2)) return; s += T(nameW + j * cw + cw / 2, top - 8 - (stag && j % 2 ? 14 : 0), c, { size: 11, fill: C.muted, anchor: 'middle' }); });
  spec.rows.forEach((r, i) => {
    const yy = top + i * (ch + 2);
    s += T(nameW - 10, yy + ch / 2 + 4, r.name, { size: 12, fill: C.ink, anchor: 'end', cls: 'tab' });
    r.cells.forEach((v, j) => { const f = fillOf(v, j); if (!f) return; s += `<rect x="${r1(nameW + j * cw + 1)}" y="${r1(yy)}" width="${r1(cw - 2)}" height="${r1(ch)}" fill="${f}" data-tip="${esc(spec.tip ? spec.tip(r, j, v) : r.name + ' ' + spec.cols[j] + ': ' + num(v, { dp: spec.dp ?? 1, sign: !!spec.sign, suffix: spec.unit?.suffix ?? '' }))}"/>`;
      // optional (farms port): spec.minLabel, cells below it are tinted but carry no number
      if (!phone && cw > 34 && spec.values !== false && !(spec.minLabel != null && v < spec.minLabel)) { const dark = f === DIV[0] || f === DIV[6] || f === C.seq[4] || f === C.seq[5]; s += T(nameW + j * cw + cw / 2, yy + ch / 2 + 4, num(v, { dp: spec.dp ?? 1 }), { size: 10.5, fill: dark ? '#fff' : C.ink2, anchor: 'middle', cls: 'tab' }); } });
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
  if (spec.groups) return _stripGroups(spec);
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
    s += `<circle cx="${r1(cx)}" cy="${r1(cy)}" r="${r}" fill="${hot ? C.ink : spec.split !== false && p.v >= (spec.ref?.value ?? Infinity) ? C.comp : C.lead}" fill-opacity="${hot ? 1 : 0.8}" data-tip="${esc(p.name + ': ' + num(p.v, { dp: spec.dp ?? 1, suffix: spec.unit?.suffix ?? '' }))}"/>`;
    if (hot) notes.push({ p, cx, cy });
  });
  if (spec.ref) { const rx = x(spec.ref.value); s += Lv(rx, 18, base + 3, C.ink, 1.25); s += T(rx + 5, 26, `${spec.ref.label} ${num(spec.ref.value, { dp: spec.dp ?? 1, suffix: spec.unit?.suffix ?? '' })}`, { size: 12, fill: C.ink, weight: 600, cls: 'halo' }); }
  // named dots: each label on the lowest row where it meets no other label, its leader ending
  // under the text
  const rowsUsed = [], colTop = cx => base - r - ((bins.get(Math.round((cx - 8) / d)) ?? []).length - 1) * d - r;
  notes.sort((a, b) => a.cx - b.cx).forEach(({ p, cx, cy }) => {
    const text = `${p.name} ${num(p.v, { dp: spec.dp ?? 1, suffix: spec.unit?.suffix ?? '' })}${p.v > N.hi ? ' →' : p.v < N.lo ? ' ←' : ''}`;
    const w = tw(text, 11.5, 500), left = cx + 3 + w > W - 2, x0 = left ? cx + 3 - w : cx - 3;
    // rows are tested at the height they are drawn (columns differ in height, so row k of one
    // label can sit at row k+1 of another): a label rises until no placed label shares its line
    const y0 = Math.min(cy - 12, colTop(cx) - 12);
    let k = 0; while (rowsUsed.some(u => Math.abs(y0 - k * 15 - u.ty) < 14 && x0 < u.x1 + 6 && x0 + w > u.x0 - 6)) k++;
    const ty = y0 - k * 15;
    rowsUsed.push({ ty, x0, x1: x0 + w });
    s += `<line x1="${r1(cx)}" x2="${r1(cx)}" y1="${r1(cy - r - 1)}" y2="${r1(ty + 5)}" stroke="${C.faint}"/>`;
    s += T(left ? cx + 3 : cx - 3, ty, text, { size: 11.5, fill: C.ink, weight: 500, anchor: left ? 'end' : 'start', cls: 'halo' });
  });
  return s + '</svg>';
}

// optional (rates port): spec.groups:[{name, values:[{name,v}], ref?:{value,label}, label?:[names]}],
// one swarm per group on one shared scale, each group named above its row with its reference
// (a median) as a short rule through the dots. Named dots are labelled beside the row's end when
// they are its extreme and there is room, else just above the stacks they span.
function _stripGroups(spec) {
  const W = spec.width, phone = W < 560, r = phone ? 2.2 : 3, d = r * 2 + (phone ? 0.7 : 1);
  const fmt = v => num(v, { dp: spec.dp ?? 1, suffix: spec.unit?.suffix ?? '' });
  const allV = spec.groups.flatMap(g => g.values.filter(p => p.v != null).map(p => p.v));
  const N = nice(spec.clamp?.[0] ?? Math.min(...allV), spec.clamp?.[1] ?? Math.max(...allV), phone ? 4 : 6), x = lin(N.lo, N.hi, 8, W - 8);
  let y0 = 0, body = '';
  for (const g of spec.groups) {
    const V = g.values.filter(p => p.v != null).sort((a, b) => a.v - b.v), bins = new Map(), at = new Map();
    for (const p of V) { const b = Math.round((x(Math.max(N.lo, Math.min(N.hi, p.v))) - 8) / d); (bins.get(b) ?? bins.set(b, []).get(b)).push(p); }
    const tall = Math.max(1, ...[...bins.values()].map(a => a.length)), named = new Set(g.label ?? []);
    const head = 24, base = y0 + head + (named.size ? 18 : 4) + tall * d;
    body += T(0, y0 + 14, g.name, { size: 12.5, fill: C.ink, weight: 600, cls: 'halo' });
    if (g.ref) body += T(tw(g.name, 12.5, 600) + 10, y0 + 14, `${g.ref.label ?? 'median'} ${fmt(g.ref.value)}`, { size: 12, fill: C.ink2, cls: 'tab halo' });
    body += Lh(8, W - 8, base + 3, C.ctx2, 1);
    for (const [b, arr] of bins) arr.forEach((p, k) => { const cx = 8 + b * d, cy = base - r - k * d; at.set(p, [cx, cy]);
      body += `<circle cx="${r1(cx)}" cy="${r1(cy)}" r="${r}" fill="${named.has(p.name) ? C.ink : C.lead}" fill-opacity="${named.has(p.name) ? 1 : 0.75}" data-tip="${esc(p.name + ': ' + fmt(p.v))}"/>`; });
    if (g.ref) body += Lv(x(g.ref.value), base - tall * d - 3, base + 3, C.ink, 1.75);
    const stack = (a, b) => { let t = 0; for (const [k, arr] of bins) { const cx = 8 + k * d; if (cx + r >= a - 2 && cx - r <= b + 2) t = Math.max(t, arr.length); } return t; };
    for (const p of V.filter(q => named.has(q.name))) {
      const [cx, cy] = at.get(p), text = `${p.name} ${fmt(p.v)}`, w = tw(text, 11.5, 500), isMin = p === V[0], isMax = p === V.at(-1);
      if (isMin && cx - 8 - w >= 0) { body += T(cx - 8, cy + 4, text, { size: 11.5, fill: C.ink, weight: 500, anchor: 'end', cls: 'halo' }); continue; }
      if (isMax && cx + 8 + w <= W) { body += T(cx + 8, cy + 4, text, { size: 11.5, fill: C.ink, weight: 500, cls: 'halo' }); continue; }
      let left = isMin; if (left && cx + 4 - w < 0) left = false; if (!left && cx - 4 + w > W) left = true;
      const a = left ? cx + 4 - w : cx - 4, ty = base - stack(a, a + w) * d - 7;
      body += `<line x1="${r1(cx)}" x2="${r1(cx)}" y1="${r1(cy - r - 1)}" y2="${r1(ty + 4)}" stroke="${C.faint}"/>`;
      body += T(left ? cx + 4 : cx - 4, ty, text, { size: 11.5, fill: C.ink, weight: 500, anchor: left ? 'end' : 'start', cls: 'halo' });
    }
    y0 = base + 16;
  }
  const H = y0 + 20;
  let s = svgOpen(W, H, spec.title);
  for (const v of N.ticks) { s += Lv(x(v), 20, y0 - 8, C.grid); s += T(x(v), H - 6, num(v, { dp: dpOf(N.step), suffix: v === N.ticks.at(-1) ? spec.unit?.suffix ?? '' : '' }), { size: 12, fill: C.muted, anchor: 'middle', cls: 'tab' }); }
  return s + body + '</svg>';
}

// ============================================================================ STACKED BARS (100%)
// Composition across units: one bar per unit, parts in a fixed order and colour, sorted by the
// part the story is about. spec: { width, rows:[{name,parts:[v],highlight?}], parts:[{name,color}], sortBy:index }
export const stackBars = (spec) => finish(_stackBars(spec));
function _stackBars(spec) {
  const W = spec.width, phone = W < 560;
  // optional: spec.sort:false keeps the rows in the given order (years, age groups);
  // spec.labels:'all' labels every wide-enough part (part.ink:true sets dark text on a pale part);
  // spec.absolute:{unit,dp} draws values, not shares, on a shared scale with each row's total
  // (and row.note) at its end
  // optional (debt port): spec.dim:true draws rows that are not highlighted in each part's pale `tint`
  const abs = spec.absolute;
  const rows = spec.rows.map(r => { const t = r.parts.reduce((a, b) => a + (b ?? 0), 0); return { ...r, tot: t, sh: r.parts.map(v => abs ? v ?? 0 : (v ?? 0) / t * 100) }; });
  const k = spec.sortBy ?? 0; if (spec.sort !== false) rows.sort((a, b) => (b.highlight ? 1e9 : 0) + b.sh[k] - (a.highlight ? 1e9 : 0) - a.sh[k]);
  const fmtA = abs?.fmt ?? (v => num(v, { dp: abs?.dp ?? 1, prefix: abs?.unit?.prefix ?? '', suffix: abs?.unit?.suffix ?? '' })); // absolute.fmt: the guide's own number renderer
  const AN = abs ? nice(0, Math.max(...rows.map(r => r.tot)), phone ? 3 : 4) : null;
  const endW = abs ? Math.max(...rows.map(r => tw(fmtA(r.tot), 12.5, 500) + (r.note ? tw(r.note, 12) + 10 : 0))) + 10 : 2;
  const nameW = phone ? 0 : Math.max(...rows.map(r => tw(r.name, 12.5, r.highlight ? 600 : 400))) + 14;
  const bh = phone ? 14 : 16, row = phone ? 38 : 26, keyRows = (() => { let n = 1, kx = phone ? 0 : nameW; for (const p of spec.parts) { const w = tw(p.name, 12) + 34; if (kx + w > W) { n++; kx = phone ? 0 : nameW; } kx += w; } return n; })(), top = keyRows * 20 + 26;
  const H = top + rows.length * row + 4, x0 = nameW, x = v => x0 + v / (abs ? AN.hi : 100) * (W - x0 - endW);
  let s = svgOpen(W, H, spec.title);
  { let kx = phone ? 0 : nameW, ky = 4; for (const p of spec.parts) { const w = tw(p.name, 12) + 34; if (kx + w > W) { kx = phone ? 0 : nameW; ky += 20; }
      s += `<rect x="${r1(kx)}" y="${ky}" width="10" height="10" fill="${p.color}"/>` + T(kx + 15, ky + 9.5, p.name, { size: 12, fill: C.ink2 }); kx += w; } }
  if (abs) for (const v of AN.ticks) s += T(x(v), top - 6, num(v, { dp: dpOf(AN.step), suffix: v === AN.hi ? abs.unit?.suffix ?? '' : '' }), { size: 11, fill: C.muted, anchor: v === 0 ? 'start' : 'middle', cls: 'tab' });
  else for (const v of [0, 50, 100]) s += T(x(v), top - 6, v + (v === 100 ? '%' : ''), { size: 11, fill: C.muted, anchor: v === 0 ? 'start' : v === 100 ? 'end' : 'middle', cls: 'tab' });
  rows.forEach((r, i) => {
    const yy = top + i * row + (phone ? 18 : (row - bh) / 2);
    if (phone) s += T(0, yy - 5, r.name, { size: 12.5, fill: C.ink, weight: r.highlight ? 600 : 400 });
    else s += T(nameW - 12, yy + bh / 2 + 4.5, r.name, { size: 12.5, fill: C.ink, weight: r.highlight ? 600 : 400, anchor: 'end' });
    let acc = 0;
    r.sh.forEach((v, j) => { if (!v) return; const a = x(acc), b = x(acc + v); acc += v;
      s += `<rect x="${r1(a)}" y="${yy}" width="${r1(Math.max(0, b - a - 1))}" height="${bh}" fill="${spec.dim && !r.highlight ? spec.parts[j].tint ?? spec.parts[j].color : spec.parts[j].color}" data-tip="${esc(r.name + ' · ' + spec.parts[j].name + ': ' + (abs ? fmtA(v) : num(v, { dp: 1, suffix: '%' })))}"/>`;
      if (!abs && b - a > 34 && (j === k || spec.labels === 'all')) s += T(a + 5, yy + bh / 2 + 4, num(v, { dp: 0, suffix: '%' }), { size: 11, fill: spec.parts[j].ink ? C.ink : '#fff', weight: 600, cls: 'tab' }); });
    if (abs) { const ex = x(acc) + 6; s += T(ex, yy + bh / 2 + 4.5, fmtA(r.tot), { size: 12.5, fill: C.ink, weight: r.highlight ? 600 : 500, cls: 'tab' });
      if (r.note) s += T(ex + tw(fmtA(r.tot), 12.5, r.highlight ? 600 : 500) + 10, yy + bh / 2 + 4.5, r.note, { size: 12, fill: C.muted, cls: 'tab' }); }
  });
  return s + '</svg>';
}

// ============================================================================ FIGURE (the number as the chart)
// spec: { value:'4.8%', label, delta:{text,dir}, spark:[[d,v]], width }
// optional (register port): color (default lead), zero (the scale takes in 0 and a faint rule marks
// it; the wash fills to it), gaps (a null breaks the line instead of being stepped over)
export function spark(data, { width = 132, height = 36, ref, color = C.lead, zero = false, gaps = false } = {}) {
  const P = data.filter(d => d[1] != null);
  const vals = P.map(d => d[1]).concat(ref != null ? [ref] : []).concat(zero ? [0] : []);
  const lo = Math.min(...vals), hi = Math.max(...vals);
  const t0 = tnum(P[0][0]), t1 = tnum(P.at(-1)[0]);
  const x = lin(t0, t1, 1, width - 5), y = lin(lo, hi, height - 4, 4);
  let d = ''; P.forEach(([dd, v], i) => { d += `${i ? 'L' : 'M'}${r1(x(tnum(dd)))},${r1(y(v))}`; });
  let line = d;
  if (gaps) { line = ''; let pen = false; for (const [dd, v] of data) { if (v == null) { pen = false; continue; } line += `${pen ? 'L' : 'M'}${r1(x(tnum(dd)))},${r1(y(v))}`; pen = true; } }
  let s = `<svg class="ak" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" aria-hidden="true">`;
  if (ref != null) s += Lh(0, width, y(ref), C.ctx2, 1).replace('/>', ' stroke-dasharray="1 2.5"/>');
  if (zero) s += Lh(0, width, y(0), C.grid, 1);
  const floor = zero ? r1(y(0)) : height;
  if (!gaps) s += `<path d="${d}L${r1(x(t1))},${floor}L${r1(x(t0))},${floor}Z" fill="${color}" fill-opacity=".07"/>`;
  s += `<path d="${line}" fill="none" stroke="${color}" stroke-width="1.5" stroke-linejoin="round"/>`;
  s += `<circle cx="${r1(x(t1))}" cy="${r1(y(P.at(-1)[1]))}" r="2.75" fill="${color}" stroke="#fff" stroke-width="1.25"/>`;
  return s + '</svg>';
}

// ============================================================================ STANDINGS (profiles port)
// Where one unit stands among all units, measure by measure: each row is one measure on its own
// scale (lowest left, highest right), every unit a quiet dot, the unit in the lead colour with its
// value above, the comparison (India) a sindoor tick, the lowest and highest units named below.
// spec: { width, rows:[{name, sub, values:[{name,v}], me, meName?, ref?, fmt:v=>text}], refName:'India' }
export const standings = (spec) => finish(_standings(spec));
function _standings(spec) {
  const W = spec.width, phone = W < 560;
  const nameW = phone ? 0 : Math.min(270, Math.round(W * 0.27));
  const x0 = nameW + (phone ? 8 : 18), x1 = W - 10, rowH = phone ? 104 : 72, top = phone ? 6 : 8;
  const R = spec.rows.map(r => ({ ...r, lines: phone ? wrap(`${r.name}, ${r.sub}`, W - 4, 12.5, 500, 2) : wrap(r.name, nameW - 8, 12.5, 500, 2) }));
  const H = top + R.length * rowH;
  let s = svgOpen(W, H, spec.title);
  R.forEach((r, i) => {
    const vs = r.values.map(u => u.v), lo = Math.min(...vs), hi = Math.max(...vs), x = lin(lo, hi, x0, x1);
    const yy = top + i * rowH + (phone ? 58 : 34);
    if (phone) r.lines.forEach((ln, k) => { s += T(0, yy - 50 + k * 15 + (r.lines.length === 1 ? 15 : 0), ln, { size: 12.5, fill: C.ink, weight: 500 }); });
    else { r.lines.forEach((ln, k) => { s += T(nameW, yy - 3 - (r.lines.length - 1 - k) * 15, ln, { size: 12.5, fill: C.ink, weight: 500, anchor: 'end' }); });
      s += T(nameW, yy + 13, r.sub, { size: 11.5, fill: C.muted, anchor: 'end' }); }
    s += Lh(x0, x1, yy, C.grid, 1);
    for (const u of r.values) if (u.v !== r.me || u.name !== r.meName) s += `<circle cx="${r1(x(u.v))}" cy="${r1(yy)}" r="3.5" fill="${C.ctx2}" data-tip="${esc(u.name + ': ' + r.fmt(u.v))}"/>`;
    if (r.ref != null) s += `<line x1="${r1(x(r.ref)) + .5}" x2="${r1(x(r.ref)) + .5}" y1="${r1(yy - 7)}" y2="${r1(yy + 7)}" stroke="${C.comp}" stroke-width="2.5" data-tip="${esc((spec.refName ?? 'Reference') + ': ' + r.fmt(r.ref))}"/>`;
    const mx = x(r.me);
    s += `<circle cx="${r1(mx)}" cy="${r1(yy)}" r="5.5" fill="${C.lead}" stroke="#fff" stroke-width="1.5" data-tip="${esc((r.meName ?? '') + ': ' + r.fmt(r.me))}"/>`;
    { const w = tw(r.fmt(r.me), 12.5, 600) / 2; s += T(Math.max(x0 - 6 + w, Math.min(x1 + 6 - w, mx)), yy - 12, r.fmt(r.me), { size: 12.5, fill: C.ink, weight: 600, anchor: 'middle', cls: 'tab halo' }); }
    // the two ends, unless the unit is one of them (its own label says it)
    const minU = r.values.find(u => u.v === lo), maxU = r.values.find(u => u.v === hi);
    const a = minU && minU.v !== r.me ? `${minU.name} ${r.fmt(lo)}` : null, b = maxU && maxU.v !== r.me ? `${maxU.name} ${r.fmt(hi)}` : null;
    const wa = a ? tw(a, 11.5) : 0, wb = b ? tw(b, 11.5) : 0, clash = a && b && x0 + wa + 12 > x1 - wb;
    if (a) s += T(x0, yy + 21, a, { size: 11.5, fill: C.muted });
    if (b) s += T(x1, yy + (clash ? 35 : 21), b, { size: 11.5, fill: C.muted, anchor: 'end' });
  });
  return s + '</svg>';
}

// ============================================================================ PANELS
// Several drawings as one: stacked top to bottom (or side by side with { across: true }),
// each kept as its own nested <svg> so its coordinates, its hover data and its labels stay its
// own. A plate with two panels is then one figure: one download, one lint, one accessible name.
// panels([svgA, svgB], { gap: 28, title: ['Credit and its trend', 'The gap'] })
// optional (panels port): a title may be [name, sub], the name in ink and the sub after it in muted,
// the sub on a line of its own when the two do not fit the panel's width
export function panels(svgs, { gap = 28, across = false, titles = [] } = {}) {
  const dims = svgs.map(v => { const m = v.slice(0, 400).match(/width="([\d.]+)" height="([\d.]+)"/); return [+m[1], +m[2]]; });
  const two = (t, w) => Array.isArray(t) && t[1] && tw(t[0], 13, 600) + 6 + tw(t[1], 12.5) > w;
  const head = (t, w) => !t ? 0 : two(t, w) ? 40 : 22;
  const hmax = across ? Math.max(0, ...titles.map((t, i) => head(t, dims[i]?.[0] ?? 0))) : 0; // side by side, the panels start on one line
  let W = 0, H = 0, body = '';
  svgs.forEach((v, i) => {
    const [w, h] = dims[i], t = titles[i], hh = across ? hmax : head(t, w);
    const x = across ? W + (i ? gap : 0) : 0, y = across ? 0 : H + (i ? gap : 0);
    if (Array.isArray(t)) {
      body += T(x, y + 13, t[0], { size: 13, fill: C.ink, weight: 600 });
      if (t[1]) body += two(t, w) ? T(x, y + 31, t[1], { size: 12.5, fill: C.muted }) : T(x + tw(t[0], 13, 600) + 6, y + 13, t[1], { size: 12.5, fill: C.muted });
    } else if (t) body += T(x, y + 13, t, { size: 13, fill: C.ink, weight: 600 });
    body += v.replace(/^<svg\b/, `<svg x="${x}" y="${y + hh}"`).replace(/\srole="img"/, '');
    if (across) { W = x + w; H = Math.max(H, h + hh); } else { W = Math.max(W, w); H = y + hh + h; }
  });
  return `<svg class="ak" width="${r1(W)}" height="${r1(H)}" viewBox="0 0 ${r1(W)} ${r1(H)}" role="img">${body}</svg>`;
}
// panelFit(width, n): side by side only when each of n panels keeps at least `min` px, else stacked
// at the full width (a phone always stacks). const { across, w, gap } = panelFit(width, 2)
export function panelFit(width, n = 2, { gap = 28, min = 340 } = {}) {
  const w = Math.floor((width - gap * (n - 1)) / n);
  return w >= min ? { across: true, w, gap } : { across: false, w: width, gap };
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
    // a stub left beside a label (the zero line's last few px past an end label) reads as a dash
    for (let i = keep.length - 1; i >= 0; i--) if (keep[i][1] - keep[i][0] < 12 && keep.length > 1 && (i === 0 || i === keep.length - 1)) keep.splice(i, 1);
    return keep.map(([u, v]) => `<line${a.replace(vert ? /\sy1="[^"]*"/ : /\sx1="[^"]*"/, vert ? ` y1="${r1(u)}"` : ` x1="${r1(u)}"`).replace(vert ? /\sy2="[^"]*"/ : /\sx2="[^"]*"/, vert ? ` y2="${r1(v)}"` : ` x2="${r1(v)}"`)}/>`).join('');
  });
}
