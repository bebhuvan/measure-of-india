/* India Atlas chart kit, v2.
   Rules of the house, after the v1 review:
   - Regular weight everywhere. One emphasised value per chart: the one the title is about.
   - Colour only for what the title names. Everything else is grey.
   - Strong colour on thin marks only; areas get pale tints with dark text.
   - Label what matters and the extremes; hover carries the rest.
   - Square ends, fine marks, generous air. One quiet Share control.
   Every chart is one SVG, drawn the same way on screen and in exported files.
   v1 is kept as kit-v1.js for the record. */
(() => {
const NS = "http://www.w3.org/2000/svg";
const C = {
  ink:"#161A22", ink2:"#4A5160", ink3:"#878D99", ink4:"#B5BAC4",
  grid:"#F0F2F5", base:"#D3D7DE", mute:"#5F6675", muteSoft:"#D5D9E0",
  blue:"#2E4BD8", blueSoft:"#B9C3F3", wash:"#F4F6FD",
  gold:"#C47A16", goldSoft:"#ECCFA6", goldWash:"rgba(196,122,22,.09)",
};
const RAMP = ["#F3F5FD","#E1E6FB","#C9D2F8","#AAB8F2","#8798EA"];   // pale on purpose: text on top stays dark

const CSS = `
text{font-family:'Golos Text',system-ui,sans-serif}
.yl,.xl{font-size:11.5px;fill:${C.ink3};font-variant-numeric:tabular-nums}
.grid{stroke:${C.grid};stroke-width:1}
.base{stroke:${C.base};stroke-width:1}
.lab{font-size:11.5px;fill:${C.ink3}}
.nt{font-size:12px;fill:${C.ink};font-weight:500}
.nb{font-size:12px;fill:${C.ink2}}
.lead{stroke:${C.ink4};stroke-width:.75;fill:none}
.ev{font-size:14px;font-weight:600;fill:${C.ink};font-variant-numeric:tabular-nums}
.ed{font-size:11.5px;fill:${C.ink3}}
.vl{font-size:12.5px;fill:${C.ink2};font-variant-numeric:tabular-nums}
.vh{font-size:12.5px;font-weight:600;fill:${C.ink};font-variant-numeric:tabular-nums}
.cat{font-size:13px;fill:${C.ink2}}
.cath{font-size:13px;fill:${C.ink};font-weight:500}
.ph{font-size:13.5px;font-weight:500;fill:${C.ink}}
.halo{paint-order:stroke;stroke:#fff;stroke-width:4px;stroke-linejoin:round}
.cross{stroke:${C.ink};stroke-width:.75;stroke-opacity:.4}
`;

/* ---------- helpers ---------- */
const S = (tag, at = {}, p) => { const e = document.createElementNS(NS, tag); for (const k in at) if (at[k] != null) e.setAttribute(k, at[k]); if (p) p.appendChild(e); return e; };
const T = (p, x, y, s, at = {}) => { const t = S("text", {x, y, ...at}, p); t.textContent = s; return t; };
const num = (v, d = 2) => (v < 0 ? "−" : "") + Math.abs(v).toFixed(d);
const sgn = (v, d = 2) => (v > 0 ? "+" : v < 0 ? "−" : "±") + Math.abs(v).toFixed(d);
const grp = v => Math.round(v).toLocaleString("en-IN");
const MON = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const M3 = MON.map(m => m.slice(0, 3));
const mi = iso => +iso.slice(0, 4) * 12 + (+iso.slice(5, 7) - 1);
const month = iso => `${MON[+iso.slice(5, 7) - 1]} ${iso.slice(0, 4)}`;
const monS = iso => `${M3[+iso.slice(5, 7) - 1]} ${iso.slice(0, 4)}`;
const pts = (dates, vals) => dates.map((d, i) => ({d, t:mi(d), v:vals[i]})).filter(p => p.v != null);
const cv = document.createElement("canvas").getContext("2d");
const tw = (s, font = "11.5px 'Golos Text'") => { cv.font = font; return cv.measureText(s).width; };
function niceTicks(lo, hi, n = 5) {
  const raw = (hi - lo) / n || 1, p = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = [1, 2, 5, 10].map(k => k * p).find(s => s >= raw);
  const t = []; for (let v = Math.floor(lo / step + 1e-9) * step; v < hi + step - 1e-9; v += step) t.push(+v.toFixed(6));
  return {t, step};
}
const fmtTick = (v, step) => num(v, step % 1 ? 1 : 0);
const RM = matchMedia("(prefers-reduced-motion: reduce)").matches;

/* a horizontal slot for a label whose baseline is ly, clear of every point and segment of every series */
function freeSlot(x0, x1, ly, w, series, x, y) {
  for (let a = x0; a + w <= x1; a += 3) {
    const ok = series.every(P => P.every((p, i) => {
      const q = P[i + 1], px = x(p.t), qx = q ? x(q.t) : px;
      if (Math.max(px, qx) < a - 4 || Math.min(px, qx) > a + w + 4) return true;
      const lo = Math.min(y(p.v), q ? y(q.v) : y(p.v)), hi = Math.max(y(p.v), q ? y(q.v) : y(p.v));
      return ly + 4 < lo || ly - 13 > hi;           // text occupies ly-11 .. ly+3, plus a little air
    }));
    if (ok) return a;
  }
  return null;
}

/* ---------- line chart ---------- */
function line(host, W, o, exp) {
  const narrow = W < 600, H = o.h ? o.h(W) : (narrow ? 280 : 370);
  const m = {l:28, r: o.endLabels ? (narrow ? 64 : 96) : 10, t:18, b:28};
  const svg = S("svg", {width:W, height:H, viewBox:`0 0 ${W} ${H}`, role:"img", "aria-label":o.aria}, host);
  const all = o.series.map(s => ({...s, p:pts(s.dates, s.vals).filter(p => p.t >= (o.from || 0))}));
  const t0 = Math.min(...all.map(s => s.p[0].t)), t1 = Math.max(...all.map(s => s.p.at(-1).t));
  const vs = all.flatMap(s => s.p.map(p => p.v)).concat(o.band || []);
  let lo = Math.min(o.zero === false ? Infinity : 0, ...vs), hi = Math.max(...vs);
  const {t:ticks, step} = niceTicks(lo, hi, narrow ? 4 : 5);
  lo = ticks[0]; hi = ticks.at(-1);
  if (o.roomBelow) lo -= step * o.roomBelow;
  const x = t => m.l + (t - t0) / Math.max(1, t1 - t0) * (W - m.l - m.r);
  const y = v => m.t + (hi - v) / (hi - lo) * (H - m.t - m.b);
  const g = {x, y, m, W, H, t0, t1, lo, hi, all, narrow, svg};

  if (o.band) S("rect", {x:m.l, width:W - m.l - m.r, y:y(o.band[1]), height:y(o.band[0]) - y(o.band[1]), fill:C.wash}, svg);
  ticks.forEach((v, i) => {
    S("line", {x1:m.l, x2:W - m.r, y1:y(v), y2:y(v), class: v === 0 ? "base" : "grid"}, svg);
    T(svg, m.l - 8, y(v) + 4, fmtTick(v, step) + (i === ticks.length - 1 && o.unit ? o.unit : ""), {class:"yl", "text-anchor":"end"});
  });
  if (o.target != null) S("line", {x1:m.l, x2:W - m.r, y1:y(o.target), y2:y(o.target), stroke:C.ink, "stroke-opacity":.38, "stroke-width":1, "stroke-dasharray":"1 3", "stroke-linecap":"round"}, svg);

  const span = t1 - t0;
  if (span <= 15) {
    for (let t = t0; t <= t1; t++) T(svg, x(t), H - 8, M3[t % 12], {class:"xl", "text-anchor": t === t0 ? "start" : t === t1 ? "end" : "middle"});
  } else {
    const yrs = []; for (let yv = Math.ceil(t0 / 12); yv * 12 <= t1; yv++) yrs.push(yv);
    const per = (W - m.l - m.r) / (span / 12), every = per < 30 ? 4 : per < 44 ? 3 : per < 62 ? 2 : 1;
    yrs.forEach(yv => { if ((yrs.at(-1) - yv) % every) return;
      const xx = x(yv * 12);
      T(svg, xx, H - 8, String(yv), {class:"xl", "text-anchor": xx - m.l < 16 ? "start" : "middle"}); });
  }
  if (o.under) o.under(g);
  if (o.gap) {
    const [A, B] = o.gap.map(i => all[i].p);
    const d = A.map((p, i) => `${i ? "L" : "M"}${x(p.t)},${y(Math.max(p.v, B[i].v))}`).join("") + B.slice().reverse().map(p => `L${x(p.t)},${y(p.v)}`).join("") + "Z";
    S("path", {d, fill:C.goldWash}, svg);
  }
  const path = arr => arr.map((p, i) => `${i ? "L" : "M"}${x(p.t).toFixed(2)},${y(p.v).toFixed(2)}`).join("");
  const draws = [];
  for (const s of all) {
    const w = s.w || 1.75;
    if (s.liveFrom && s.p[0].t < mi(s.liveFrom)) {
      const k = s.p.findIndex(p => p.t >= mi(s.liveFrom));
      draws.push(S("path", {d:path(s.p.slice(0, k + 1)), fill:"none", stroke:s.color, "stroke-opacity":.32, "stroke-width":1.2, "stroke-linejoin":"round"}, svg));
      draws.push(S("path", {d:path(s.p.slice(k)), fill:"none", stroke:s.color, "stroke-width":w, "stroke-linejoin":"round", "stroke-linecap":"round"}, svg));
    } else draws.push(S("path", {d:path(s.p), fill:"none", stroke:s.color, "stroke-width":w, "stroke-linejoin":"round", "stroke-linecap":"round"}, svg));
  }
  if (o.over) o.over(g);
  const ends = [];
  if (o.endLabels) {
    const L = all.filter(s => !s.noEnd).map(s => ({s, p:s.p.at(-1), y:y(s.p.at(-1).v)})).sort((a, b) => a.y - b.y);
    for (let i = 1; i < L.length; i++) if (L[i].y - L[i - 1].y < 30) L[i].y = L[i - 1].y + 30;
    L.forEach(l => {
      const ex = x(l.p.t), ey = y(l.p.v);
      ends.push(S("circle", {cx:ex, cy:ey, r:3, fill:l.s.color, stroke:"#fff", "stroke-width":1.5}, svg));
      ends.push(T(svg, ex + 10, l.y + 1, `${num(l.p.v, l.s.dp ?? 2)}${l.s.unit ?? "%"}`, {class: l.s.emph === false ? "vl" : "ev"}));
      ends.push(T(svg, ex + 10, l.y + 15, l.s.endName || monS(l.p.d), {class:"ed"}));
    });
  }
  if (exp) return svg;
  if (!RM && o.animate) {
    draws.forEach(p => { const L = p.getTotalLength(); p.style.strokeDasharray = L; p.style.strokeDashoffset = L; });
    ends.forEach(e => e.style.opacity = 0);
    const io = new IntersectionObserver(es => { if (!es[0].isIntersecting) return; io.disconnect();
      draws.forEach(p => { p.style.transition = "stroke-dashoffset 1200ms cubic-bezier(.33,.66,.25,1)"; p.style.strokeDashoffset = 0; });
      ends.forEach(e => { e.style.transition = "opacity 300ms ease 1050ms"; e.style.opacity = 1; }); }, {threshold:.35});
    io.observe(svg);
  }
  const cross = S("line", {y1:m.t, y2:H - m.b, class:"cross", visibility:"hidden"}, svg);
  const rings = all.map(s => S("circle", {r:3.75, fill:"#fff", stroke:s.color, "stroke-width":1.5, visibility:"hidden"}, svg));
  const hit = S("rect", {x:m.l, y:0, width:W - m.l - m.r, height:H, fill:"transparent"}, svg);
  svg.setAttribute("tabindex", 0);
  const p0 = all[0].p; let idx = p0.length - 1;
  const show = i => { idx = i; const t = p0[i].t;
    cross.setAttribute("x1", x(t)); cross.setAttribute("x2", x(t)); cross.setAttribute("visibility", "visible");
    all.forEach((s, j) => { const q = s.p.find(p => p.t === t); rings[j].setAttribute("visibility", q ? "visible" : "hidden"); if (q) { rings[j].setAttribute("cx", x(t)); rings[j].setAttribute("cy", y(q.v)); } });
    o.readout && o.readout(t); };
  const clear = () => { cross.setAttribute("visibility", "hidden"); rings.forEach(r => r.setAttribute("visibility", "hidden")); o.readout && o.readout(null); };
  hit.addEventListener("pointermove", e => { const r = svg.getBoundingClientRect(), t = t0 + (e.clientX - r.left - m.l) / (W - m.l - m.r) * (t1 - t0);
    let b = 0; p0.forEach((p, j) => { if (Math.abs(p.t - t) < Math.abs(p0[b].t - t)) b = j; }); show(b); });
  hit.addEventListener("pointerleave", clear);
  svg.addEventListener("keydown", e => { if (e.key === "ArrowLeft" || e.key === "ArrowRight") { e.preventDefault(); show(Math.max(0, Math.min(p0.length - 1, idx + (e.key === "ArrowRight" ? 1 : -1)))); } });
  svg.addEventListener("blur", clear);
  return svg;
}

/* an annotation: a small point, a hairline leader, a date in ink and a quiet note on one line */
function note(g, {t, v, title, text, side = "left", drop = 0}) {
  const {x, y, svg, narrow} = g, px = x(t), py = y(v);
  const tx = side === "left" ? px - 10 : px + 10, ty = py + drop;
  S("circle", {cx:px, cy:py, r:2.5, fill:C.ink}, svg);
  S("path", {d:`M${px},${py + (drop > 0 ? 4 : -4)}V${ty - 4}H${tx + (side === "left" ? 3 : -3)}`, class:"lead"}, svg);
  const anchor = side === "left" ? "end" : "start";
  if (narrow || !text) { T(svg, tx, ty, title, {class:"nt halo", "text-anchor":anchor}); return; }
  const t1 = T(svg, tx, ty, "", {class:"nb halo", "text-anchor":anchor});
  const a = S("tspan", {class:"nt"}, t1); a.textContent = title;
  const b = S("tspan", {}, t1); b.textContent = "  " + text;
}

/* ---------- dot plot: last month to this month, one row highlighted ---------- */
function dots(host, W, o, exp) {
  const narrow = W < 600, rows = o.rows, cap = o.cap, maxV = Math.max(...rows.flatMap(r => [r.a, r.b]));
  const lab = narrow ? 0 : 226, valW = narrow ? 44 : 64, top = 28, rowH = narrow ? 46 : 31;
  const H = top + rows.length * rowH + 24;
  const svg = S("svg", {width:W, height:H, viewBox:`0 0 ${W} ${H}`, role:"img", "aria-label":o.aria}, host);
  const x1 = W - valW - 16, brk = 18, seg = narrow ? 30 : 44, capX = x1 - brk - seg;
  const x = v => v <= cap ? lab + v / cap * (capX - lab) : capX + brk + (v - cap) / (maxV - cap) * seg;
  const {t:ticks} = niceTicks(0, cap, 4);
  ticks.filter(v => v <= cap).forEach((v, i, a) => {
    S("line", {x1:x(v), x2:x(v), y1:top - 4, y2:H - 22, class: v ? "grid" : "base"}, svg);
    T(svg, x(v), H - 6, v === a.at(-1) ? v + "%" : String(v), {class:"xl", "text-anchor":"middle"});
  });
  const bx = capX + brk / 2;
  S("path", {d:`M${bx - 4},${H - 17}L${bx},${H - 27}M${bx},${H - 17}L${bx + 4},${H - 27}`, stroke:C.ink4, "stroke-width":1}, svg);
  if (o.valHead) T(svg, W, top - 12, o.valHead, {class:"xl", "text-anchor":"end"});
  if (o.ref != null) {
    const rx = x(o.ref);
    S("line", {x1:rx, x2:rx, y1:top - 4, y2:H - 22, stroke:C.ink, "stroke-opacity":.38, "stroke-width":1, "stroke-dasharray":"1 3", "stroke-linecap":"round"}, svg);
    T(svg, rx, top - 12, o.refLabel, {class:"lab", "text-anchor":"middle"});
  }
  rows.forEach((r, j) => {
    const yy = top + j * rowH + (narrow ? 29 : 13), hl = r.n === o.highlight;
    const cls = hl ? "cath" : "cat";
    if (narrow) T(svg, 0, yy - 12, r.n, {class:cls + " halo", style:"font-size:12.5px"});
    else T(svg, lab - 18, yy + 4.5, r.n, {class:cls, "text-anchor":"end"});
    const xa = x(r.a), xb = x(r.b);
    S("line", {x1:Math.min(xa, xb), x2:Math.max(xa, xb), y1:yy, y2:yy, stroke: hl ? C.blueSoft : C.muteSoft, "stroke-width":2}, svg);
    S("circle", {cx:xa, cy:yy, r:3.25, fill:"#fff", stroke: hl ? C.blue : C.ink4, "stroke-width":1.25}, svg);
    S("circle", {cx:xb, cy:yy, r:3.75, fill: hl ? C.blue : C.mute}, svg);
    T(svg, W, yy + 4.5, num(r.b), {class: hl ? "vh" : "vl", "text-anchor":"end"});
    if (hl && !narrow) T(svg, Math.max(xa, xb) + 10, yy + 4, `${sgn(r.b - r.a)} points since May`, {class:"nb halo"});
  });
  return svg;
}

/* ---------- heat table: rows × months, pale scale, dark text ---------- */
function heat(host, W, o, exp) {
  const narrow = W < 600, lab = narrow ? 120 : 226, cols = o.cols.length, top = 26;
  const cw = (W - lab) / cols, ch = narrow ? 29 : 31, H = top + o.rows.length * ch + 4;
  const svg = S("svg", {width:W, height:H, viewBox:`0 0 ${W} ${H}`, role:"img", "aria-label":o.aria}, host);
  o.cols.forEach((c, i) => T(svg, lab + i * cw + cw / 2, top - 11, c, {class:"xl", "text-anchor":"middle"}));
  o.rows.forEach((r, j) => {
    const yy = top + j * ch, hl = (o.highlight || []).includes(r.n);
    T(svg, lab - 16, yy + ch / 2 + 4.5, narrow ? (r.short || r.n) : r.n, {class: hl ? "cath" : "cat", "text-anchor":"end", style: narrow ? "font-size:12px" : ""});
    r.v.forEach((v, i) => {
      S("rect", {x:lab + i * cw + 1, y:yy + 1, width:cw - 2, height:ch - 2, fill:RAMP[o.bin(v)]}, svg);
      T(svg, lab + i * cw + cw / 2, yy + ch / 2 + 4.5, Math.abs(v) < .05 ? "0.0" : num(v, 1), {"text-anchor":"middle", style:`font-size:${narrow ? 11.5 : 12.5}px;font-variant-numeric:tabular-nums;fill:${hl ? C.ink : C.ink2};font-weight:${hl && i === cols - 1 ? 600 : 400}`});
    });
  });
  return svg;
}

/* ---------- bars around zero: the named rows in colour, the rest pale ---------- */
function diverging(host, W, o, exp) {
  const narrow = W < 600, rows = o.rows, lab = narrow ? 104 : 176, top = 6, rowH = 27, bh = 8;
  const H = top + rows.length * rowH + 24;
  const svg = S("svg", {width:W, height:H, viewBox:`0 0 ${W} ${H}`, role:"img", "aria-label":o.aria}, host);
  const lo = Math.min(0, ...rows.map(r => r.v)), hi = Math.max(0, ...rows.map(r => r.v));
  const {t:ticks} = niceTicks(lo, hi, narrow ? 4 : 7);
  const pad = narrow ? 46 : 56, x0 = lab + pad, x1 = W - pad;
  const x = v => x0 + (v - ticks[0]) / (ticks.at(-1) - ticks[0]) * (x1 - x0);
  ticks.forEach(v => { S("line", {x1:x(v), x2:x(v), y1:top - 2, y2:H - 20, class: v === 0 ? "base" : "grid"}, svg);
    T(svg, x(v), H - 5, (v > 0 ? "+" : "") + num(v, 0) + (v === ticks.at(-1) ? "%" : ""), {class:"xl", "text-anchor":"middle"}); });
  rows.forEach((r, j) => {
    const yy = top + j * rowH + (rowH - bh) / 2, pos = r.v >= 0, hl = (o.highlight || []).includes(r.n);
    const col = pos ? (hl ? C.blue : C.blueSoft) : (hl ? C.gold : C.goldSoft);
    T(svg, lab - 4, yy + bh, r.n, {class: hl ? "cath" : "cat", "text-anchor":"end", style: narrow ? "font-size:12px" : ""});
    const xa = x(0), xb = x(r.v);
    S("rect", {x:Math.min(xa, xb), y:yy, width:Math.max(1, Math.abs(xb - xa)), height:bh, fill:col}, svg);
    T(svg, pos ? xb + 7 : xb - 7, yy + bh, (r.v > 0 ? "+" : "") + num(r.v, 1), {class: hl ? "vh halo" : "vl halo", "text-anchor": pos ? "start" : "end", style:"font-size:12px"});
  });
  return svg;
}

/* ---------- tile map + ranked list ---------- */
function tiles(host, W, o, exp) {
  const side = W >= 1000, cell = 60, gap = 3, cols = 9, rows = 7;
  const mapW = Math.min(side ? 540 : 580, W), sc = mapW / (cols * cell), mapH = rows * cell * sc;
  const lcols = side ? 2 : W >= 700 ? 3 : 2;
  const listTop = side ? 0 : mapH + 70, perCol = Math.ceil(o.list.length / lcols), lh = side ? Math.max(19, (mapH + 44) / perCol) : 23;
  const H = side ? Math.max(mapH + 52, perCol * lh + 4) : listTop + perCol * lh + 4;
  const svg = S("svg", {width:W, height:H, viewBox:`0 0 ${W} ${H}`, role:"img", "aria-label":o.aria}, host);
  const gm = S("g", {transform:`scale(${sc})`}, svg), big = sc < .72;
  const hlk = o.highlight || [];
  for (const k in o.tiles) {
    const [code, cx, cy] = o.tiles[k], v = o.val(k), b = o.bin(v), hl = hlk.includes(k);
    const g = S("g", {transform:`translate(${cx * cell},${cy * cell})`}, gm);
    S("rect", {width:cell - gap, height:cell - gap, fill:RAMP[b]}, g);
    if (hl) S("rect", {x:.75, y:.75, width:cell - gap - 1.5, height:cell - gap - 1.5, fill:"none", stroke:C.ink, "stroke-width":1.5}, g);
    T(g, 7, big ? 22 : 18, code, {style:`font-size:${big ? 17 : 12}px;font-weight:500;fill:${C.ink}`});
    T(g, 7, cell - gap - (big ? 8 : 9), big ? v.toFixed(1) : num(v), {style:`font-size:${big ? 16 : 12}px;fill:${hl ? C.ink : C.ink2};font-weight:${hl ? 600 : 400};font-variant-numeric:tabular-nums`});
    if (!exp) { const tt = S("title", {}, g); tt.textContent = `${o.name(k)}: ${num(v)}%`; }
  }
  const ly = mapH + 26;
  T(svg, 0, ly + 8, "Per cent", {class:"lab"});
  const lx = 58, sw = 34;
  RAMP.forEach((r, i) => S("rect", {x:lx + i * sw, y:ly, width:sw - 1, height:8, fill:r}, svg));
  o.binLabels.forEach((t, i) => T(svg, lx + (i + 1) * sw - .5, ly + 23, t, {class:"lab", "text-anchor":"middle"}));
  const lx0 = side ? mapW + 56 : 0, colW = ((side ? W - lx0 : W) - 32 * (lcols - 1)) / lcols;
  const SH = {"Andaman and Nicobar":"Andaman and N.", "Dadra, Daman and Diu":"Dadra and Daman", "Jammu and Kashmir":"J and K", "Arunachal Pradesh":"Arunachal", "Himachal Pradesh":"Himachal"};
  o.list.forEach((r, i) => {
    const c = Math.floor(i / perCol), yy = listTop + (i % perCol) * lh + 13, xx = lx0 + c * (colW + 32);
    const nm = tw(r.n, "12.5px 'Golos Text'") > colW - 42 && SH[r.n] ? SH[r.n] : r.n;
    const st = r.hl ? `fill:${C.blue};font-weight:500` : r.em ? `fill:${C.ink};font-weight:500` : "";
    T(svg, xx, yy, nm, {class:"cat", style:`font-size:12.5px;${st}`});
    T(svg, xx + colW, yy, num(r.v), {class:"vl", "text-anchor":"end", style:`font-size:12.5px;${st}`});
  });
  return svg;
}

/* ---------- small multiples with a grey context line ---------- */
function multiples(host, W, o, exp) {
  const cols = W < 600 ? 2 : 3, gx = W < 600 ? 20 : 40, pw = (W - gx * (cols - 1)) / cols, ph = W < 600 ? 100 : 118, head = 42, gy = 32;
  const rowsN = Math.ceil(o.panels.length / cols), H = rowsN * (head + ph) + (rowsN - 1) * gy + 4;
  const svg = S("svg", {width:W, height:H, viewBox:`0 0 ${W} ${H}`, role:"img", "aria-label":o.aria}, host);
  const [lo, hi] = o.domain, P = [];
  o.panels.forEach((pn, j) => {
    const ox = (j % cols) * (pw + gx), oy = Math.floor(j / cols) * (head + ph + gy);
    const g = S("g", {transform:`translate(${ox},${oy})`}, svg);
    const pp = pts(o.dates, pn.vals), ctx = pts(o.dates, o.context.vals), t0 = pp[0].t, t1 = pp.at(-1).t, last = pp.at(-1);
    const ml = j % cols === 0 ? 26 : 4;
    const x = t => ml + (t - t0) / (t1 - t0) * (pw - ml - 8), y = v => head + 4 + (hi - v) / (hi - lo) * (ph - 24);
    T(g, 0, 14, pn.n, {class:"ph"});
    const hv = T(g, 0, 33, `${num(last.v)}%`, {class:"ev", style:"font-size:14px"});
    const hd = T(g, tw(`${num(last.v)}%`, "600 14px 'Golos Text'") + 7, 33, monS(last.d), {class:"ed"});
    o.ticks.forEach(v => { S("line", {x1:ml, x2:pw - 8, y1:y(v), y2:y(v), class: v === 0 ? "base" : "grid"}, g);
      if (j % cols === 0) T(g, ml - 6, y(v) + 4, v > 0 ? "+" + v : num(v, 0), {class:"yl", "text-anchor":"end", style:"font-size:10.5px"}); });
    o.years.forEach(yv => { if (yv * 12 >= t0 && yv * 12 <= t1) T(g, x(yv * 12), head + ph - 3, String(yv), {class:"xl", "text-anchor":"middle", style:"font-size:10.5px"}); });
    S("path", {d:ctx.filter(p => p.t >= t0).map((p, i) => `${i ? "L" : "M"}${x(p.t).toFixed(1)},${y(p.v).toFixed(1)}`).join(""), fill:"none", stroke:C.ink4, "stroke-width":1, "stroke-linejoin":"round"}, g);
    S("path", {d:pp.map((p, i) => `${i ? "L" : "M"}${x(p.t).toFixed(1)},${y(p.v).toFixed(1)}`).join(""), fill:"none", stroke:C.blue, "stroke-width":1.5, "stroke-linejoin":"round"}, g);
    S("circle", {cx:x(last.t), cy:y(last.v), r:2.75, fill:C.blue, stroke:"#fff", "stroke-width":1.25}, g);
    P.push({g, x, y, pp, hv, hd, last, ox, oy});
  });
  if (exp) return svg;
  P.forEach(pn => { pn.cross = S("line", {y1:head + 4, y2:head + ph - 20, class:"cross", visibility:"hidden"}, pn.g);
    pn.ring = S("circle", {r:3.5, fill:"#fff", stroke:C.blue, "stroke-width":1.5, visibility:"hidden"}, pn.g); });
  const sync = t => P.forEach(pn => { const p = t == null ? null : pn.pp.find(q => q.t === t), s = p || pn.last;
    pn.hv.textContent = `${num(s.v)}%`; pn.hd.textContent = monS(s.d); pn.hd.setAttribute("x", tw(`${num(s.v)}%`, "600 14px 'Golos Text'") + 7);
    [pn.cross, pn.ring].forEach(e => e.setAttribute("visibility", p ? "visible" : "hidden"));
    if (p) { pn.cross.setAttribute("x1", pn.x(t)); pn.cross.setAttribute("x2", pn.x(t)); pn.ring.setAttribute("cx", pn.x(t)); pn.ring.setAttribute("cy", pn.y(p.v)); } });
  const hit = S("rect", {x:0, y:0, width:W, height:H, fill:"transparent"}, svg);
  hit.addEventListener("pointermove", e => { const r = svg.getBoundingClientRect(), px = e.clientX - r.left, py = e.clientY - r.top;
    const pn = P.find(q => px >= q.ox && px <= q.ox + pw && py >= q.oy && py <= q.oy + head + ph); if (!pn) return sync(null);
    let b = pn.pp[0]; pn.pp.forEach(p => { if (Math.abs(pn.x(p.t) - (px - pn.ox)) < Math.abs(pn.x(b.t) - (px - pn.ox))) b = p; }); sync(b.t); });
  hit.addEventListener("pointerleave", () => sync(null));
  return svg;
}

/* ---------- a word-sized chart ---------- */
function mini(dates, vals, {w = 132, h = 40, color = C.blue, kind = "line", zero = false} = {}) {
  const P = pts(dates, vals); if (!P.length) return "";
  const lo = Math.min(zero ? 0 : Infinity, ...P.map(p => p.v)), hi = Math.max(...P.map(p => p.v));
  const t0 = P[0].t, t1 = P.at(-1).t;
  const x = t => 3 + (t - t0) / Math.max(1, t1 - t0) * (w - 8), y = v => 4 + (hi - v) / ((hi - lo) || 1) * (h - 9);
  if (kind === "slope") {
    const a = P[0], b = P.at(-1);
    return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" aria-hidden="true"><line x1="${x(a.t)}" x2="${x(b.t)}" y1="${y(a.v)}" y2="${y(b.v)}" stroke="${C.blueSoft}" stroke-width="1.5"/>
      <circle cx="${x(a.t)}" cy="${y(a.v)}" r="3" fill="#fff" stroke="${C.ink4}" stroke-width="1.25"/><circle cx="${x(b.t)}" cy="${y(b.v)}" r="3.25" fill="${color}"/></svg>`;
  }
  const d = P.map((p, i) => `${i ? "L" : "M"}${x(p.t).toFixed(1)},${y(p.v).toFixed(1)}`).join("");
  const zl = lo < 0 && hi > 0 ? `<line x1="2" x2="${w - 3}" y1="${y(0)}" y2="${y(0)}" stroke="${C.base}"/>` : "";
  return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" aria-hidden="true">${zl}<path d="${d}" fill="none" stroke="${color}" stroke-width="1.35" stroke-linejoin="round" stroke-linecap="round"/><circle cx="${x(P.at(-1).t)}" cy="${y(P.at(-1).v)}" r="2.4" fill="${color}"/></svg>`;
}

/* ---------- the current reading against the band ---------- */
function bandScale(host, W, {v, band, target, max}) {
  const H = 58, x = q => 2 + q / max * (W - 4);
  const svg = S("svg", {width:W, height:H, viewBox:`0 0 ${W} ${H}`, role:"img", "aria-label":`${num(v)}% against the RBI band of ${band[0]} to ${band[1]}%`}, host);
  S("rect", {x:x(band[0]), y:22, width:x(band[1]) - x(band[0]), height:8, fill:C.wash}, svg);
  S("line", {x1:x(0), x2:x(max), y1:26, y2:26, stroke:C.base}, svg);
  S("line", {x1:x(target), x2:x(target), y1:16, y2:36, stroke:C.ink, "stroke-opacity":.38, "stroke-dasharray":"1 3", "stroke-linecap":"round"}, svg);
  for (let q = 0; q <= max; q += 2) T(svg, x(q), 52, q + (q === max ? "%" : ""), {class:"xl", "text-anchor": q === 0 ? "start" : q === max ? "end" : "middle"});
  S("circle", {cx:x(v), cy:26, r:4.5, fill:C.blue, stroke:"#fff", "stroke-width":2}, svg);
  T(svg, x(target), 9, "Target", {class:"lab", "text-anchor":"middle"});
  return svg;
}

/* ---------- the card: title, controls, chart, source, one Share control ---------- */
const REG = {};
let openMenu = null;
const closeMenu = () => { if (!openMenu) return; openMenu.classList.remove("open"); openMenu.querySelector(".sh").setAttribute("aria-expanded", "false"); openMenu = null; };
document.addEventListener("click", e => { if (openMenu && !openMenu.contains(e.target)) closeMenu(); });
document.addEventListener("keydown", e => { if (e.key === "Escape" && openMenu) { const b = openMenu.querySelector(".sh"); closeMenu(); b.focus(); } });
function card(spec) {
  const el = document.getElementById(spec.id); if (!el) return;
  REG[spec.id] = spec; spec.el = el; el.classList.add("card");
  el.innerHTML = `<header><h3>${spec.title}</h3><p class="sub">${spec.sub}</p></header>
    <div class="bar">${spec.ranges ? `<div class="ranges" role="group" aria-label="Time range">${spec.ranges.map(([l], i) => `<button type="button" aria-pressed="${i === spec.ranges.length - 1}" data-i="${i}">${l}</button>`).join("")}</div>`
      : spec.key ? `<div class="key">${spec.key.map(([l, col, kind]) => `<span><i class="${kind || ""}" style="--c:${col}"></i>${l}</span>`).join("")}</div>` : "<div></div>"}
      ${spec.readout ? `<div class="readout" aria-live="polite"></div>` : ""}</div>
    <div class="plot"></div>
    <figcaption class="cf"><div class="srcs">${spec.source}</div>
      <div class="share"><button type="button" class="sh" aria-haspopup="true" aria-expanded="false">Share</button>
        <div class="menu" role="menu"><button type="button" role="menuitem" data-a="png">Download image</button><button type="button" role="menuitem" data-a="svg">Download SVG</button><button type="button" role="menuitem" data-a="csv">Download data</button><button type="button" role="menuitem" data-a="link">Copy link</button><button type="button" role="menuitem" data-a="embed">Copy embed code</button></div></div></figcaption>`;
  spec.state = {from: spec.ranges ? spec.ranges.at(-1)[1] : 0, drawn:false};
  const ro = el.querySelector(".readout");
  if (ro) spec.state.readout = t => { const [a, b] = spec.readout(t ?? spec.lastT); ro.innerHTML = `<span>${a}</span><b>${b}</b>`; };
  if (spec.ranges) el.querySelectorAll(".ranges button").forEach(b => b.addEventListener("click", () => {
    el.querySelectorAll(".ranges button").forEach(q => q.setAttribute("aria-pressed", q === b));
    spec.state.from = spec.ranges[+b.dataset.i][1]; draw(spec, true); }));
  const sh = el.querySelector(".share"), btn = sh.querySelector(".sh");
  btn.addEventListener("click", e => { e.stopPropagation(); const open = !sh.classList.contains("open"); closeMenu();
    if (open) { sh.classList.add("open"); btn.setAttribute("aria-expanded", "true"); openMenu = sh; sh.querySelector(".menu button").focus(); } });
  sh.querySelectorAll(".menu button").forEach(b => b.addEventListener("click", async e => { e.stopPropagation(); closeMenu(); await act(spec, b.dataset.a, btn); }));
  draw(spec);
}
function draw(spec, quiet) {
  const plot = spec.el.querySelector(".plot"); plot.innerHTML = "";
  spec.draw(plot, plot.clientWidth, false, {...spec.state, animate: !spec.state.drawn && !quiet});
  spec.state.drawn = true;
  spec.state.readout && spec.state.readout(null);
}
let lastW = innerWidth, pend;
addEventListener("resize", () => { if (innerWidth === lastW) return; lastW = innerWidth; cancelAnimationFrame(pend); pend = requestAnimationFrame(() => Object.values(REG).forEach(s => draw(s, true))); });

/* ---------- export: a finished graphic, 1200 wide, saved at 2x ---------- */
let FONTS = null;
async function fontCSS() {
  if (FONTS != null) return FONTS;
  try {
    const css = await (await fetch("https://fonts.googleapis.com/css2?family=Golos+Text:wght@400;500;600&family=Source+Serif+4:opsz,wght@8..60,500&display=swap")).text();
    const blocks = css.split("/*").filter(b => /^\s*latin \*\//.test(b)).map(b => "/*" + b), out = [];
    for (const b of blocks) {
      const url = (b.match(/url\(([^)]+)\)/) || [])[1]; if (!url) continue;
      const u8 = new Uint8Array(await (await fetch(url)).arrayBuffer()); let bin = "";
      for (let i = 0; i < u8.length; i += 0x8000) bin += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
      out.push(b.replace(url, `data:font/woff2;base64,${btoa(bin)}`));
    }
    FONTS = out.join("\n");
  } catch (e) { FONTS = ""; }
  return FONTS;
}
const esc = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;");
const strip = s => s.replace(/<[^>]+>/g, "");
function wrap(s, font, maxW) { const out = []; let cur = ""; for (const w of s.split(" ")) { const t = cur ? cur + " " + w : w; if (tw(t, font) > maxW && cur) { out.push(cur); cur = w; } else cur = t; } if (cur) out.push(cur); return out; }
async function build(spec) {
  const Wd = 1200, P = 64, inner = Wd - 2 * P, parts = [];
  let yy = P + 26;
  wrap(strip(spec.title), "500 33px 'Source Serif 4'", inner - 40).forEach(l => { parts.push(`<text x="${P}" y="${yy}" style="font:500 33px 'Source Serif 4',serif;fill:${C.ink};letter-spacing:-.012em">${esc(l)}</text>`); yy += 41; });
  yy += 4;
  wrap(strip(spec.sub), "400 17px 'Golos Text'", inner - 80).forEach(l => { parts.push(`<text x="${P}" y="${yy}" style="font:400 17px 'Golos Text';fill:${C.ink2}">${esc(l)}</text>`); yy += 26; });
  yy += 22;
  if (spec.key) { let kx = P; for (const [l, col, kind] of spec.key) {
    if (kind === "sq") parts.push(`<rect x="${kx}" y="${yy - 10}" width="10" height="10" fill="${col}"/>`);
    else if (kind === "ring") parts.push(`<circle cx="${kx + 5}" cy="${yy - 4.5}" r="3.5" fill="#fff" stroke="${col}" stroke-width="1.25"/>`);
    else if (kind === "dot") parts.push(`<circle cx="${kx + 5}" cy="${yy - 4.5}" r="4" fill="${col}"/>`);
    else parts.push(`<rect x="${kx}" y="${yy - 5.5}" width="16" height="2" fill="${col}"/>`);
    const off = kind ? 17 : 24;
    parts.push(`<text x="${kx + off}" y="${yy}" style="font:400 14px 'Golos Text';fill:${C.ink2}">${esc(l)}</text>`);
    kx += off + tw(l, "14px 'Golos Text'") + 26; } yy += 26; }
  const tmp = document.createElement("div"); tmp.style.cssText = `position:absolute;left:-99999px;top:0;width:${inner}px`; document.body.appendChild(tmp);
  const chart = spec.draw(tmp, inner, true, {...spec.state, animate:false});
  const ch = +chart.getAttribute("height");
  const xml = new XMLSerializer().serializeToString(chart).replace(/^<svg[^>]*>/, "").replace(/<\/svg>$/, "");
  tmp.remove();
  parts.push(`<g transform="translate(${P},${yy})">${xml}</g>`);
  yy += ch + 34;
  const src = wrap(strip(spec.source), "400 13px 'Golos Text'", inner - 260);
  src.forEach((l, i) => parts.push(`<text x="${P}" y="${yy + i * 19}" style="font:400 13px 'Golos Text';fill:${C.ink3}">${esc(l)}</text>`));
  parts.push(`<text x="${Wd - P}" y="${yy + 1}" text-anchor="end" style="font:500 18px 'Source Serif 4',serif;fill:${C.ink}">India Atlas</text>`);
  parts.push(`<text x="${Wd - P}" y="${yy + 20}" text-anchor="end" style="font:400 12.5px 'Golos Text';fill:${C.ink3}">atlas.thisindianlife.today</text>`);
  yy += Math.max(src.length * 19, 26) + P - 18;
  const H = Math.ceil(yy);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${Wd}" height="${H}" viewBox="0 0 ${Wd} ${H}"><style>${await fontCSS()}\n${CSS}</style><rect width="100%" height="100%" fill="#fff"/>${parts.join("")}</svg>`;
  return {svg, w:Wd, h:H};
}
function dl(blob, name) { const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500); }
async function png(spec) {
  const {svg, w, h} = await build(spec), img = new Image(), u = URL.createObjectURL(new Blob([svg], {type:"image/svg+xml"}));
  await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = u; });
  const c = document.createElement("canvas"); c.width = w * 2; c.height = h * 2; const g = c.getContext("2d"); g.scale(2, 2); g.drawImage(img, 0, 0); URL.revokeObjectURL(u);
  return new Promise(res => c.toBlob(res, "image/png"));
}
async function copy(t) { try { await navigator.clipboard.writeText(t); return true; } catch (e) { return false; } }
function flash(b, msg) { const o = b.dataset.l || b.textContent; b.dataset.l = o; b.textContent = msg; b.classList.add("st"); setTimeout(() => { b.textContent = o; b.classList.remove("st"); }, 1800); }
async function act(spec, a, b) {
  if (a === "png") { flash(b, "Preparing image"); dl(await png(spec), spec.file + ".png"); flash(b, "Image downloaded"); }
  if (a === "svg") { dl(new Blob([(await build(spec)).svg], {type:"image/svg+xml"}), spec.file + ".svg"); flash(b, "SVG downloaded"); }
  if (a === "csv") { dl(new Blob([spec.csv() + "\n"], {type:"text/csv"}), spec.file + ".csv"); flash(b, "Data downloaded"); }
  if (a === "link") flash(b, (await copy(location.href.split("#")[0] + "#" + spec.id)) ? "Link copied" : "Copy failed");
  if (a === "embed") flash(b, (await copy(`<iframe src="https://atlas.thisindianlife.today/embed/${spec.id}" title="${strip(spec.title).replace(/"/g, "&quot;")}" width="100%" height="580" style="border:0"></iframe>`)) ? "Embed code copied" : "Copy failed");
}

const st = document.createElement("style"); st.textContent = CSS.trim().split("\n").map(r => ".plot " + r).join("\n"); document.head.appendChild(st);

window.Kit = {C, RAMP, S, T, num, sgn, grp, MON, M3, mi, month, monS, pts, tw, niceTicks, freeSlot, line, note, dots, heat, diverging, tiles, multiples, mini, bandScale, card, build, REG};
})();
