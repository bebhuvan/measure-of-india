/* India Atlas chart kit.
   Every chart is one SVG, drawn the same way on screen and in exported files.
   House rules: ultramarine for the series that matters, marigold as the only second
   colour, cool greys for context. Hairline grids. Labels never struck by lines. */
(() => {
const NS = "http://www.w3.org/2000/svg";
const C = {
  ink:"#161A22", ink2:"#4A5160", ink3:"#868D9B", ink4:"#AEB4BF",
  grid:"#EFF1F4", base:"#C3C8D1",
  blue:"#2E4BD8", blueSoft:"#AAB6F2", wash:"#F3F5FE", washEdge:"#DCE2FB",
  gold:"#C47A16", goldSoft:"#EFC07C", goldWash:"rgba(196,122,22,.13)",
};
const RAMP = ["#EAEEFD","#C9D2F8","#9DADF1","#6880E6","#2E4BD8"];

const CSS = `
text{font-family:'Golos Text',system-ui,sans-serif}
.yl,.xl{font-size:12px;fill:${C.ink3};font-variant-numeric:tabular-nums}
.grid{stroke:${C.grid};stroke-width:1}
.base{stroke:${C.base};stroke-width:1}
.lab{font-size:12px;fill:${C.ink2}}
.labq{font-size:12px;fill:${C.ink3}}
.nt{font-size:12.5px;fill:${C.ink};font-weight:600}
.nb{font-size:12.5px;fill:${C.ink2}}
.lead{stroke:${C.ink4};stroke-width:1;fill:none}
.ev{font-size:15px;font-weight:600;fill:${C.ink};font-variant-numeric:tabular-nums}
.ed{font-size:12px;fill:${C.ink3}}
.vl{font-size:13px;font-weight:600;fill:${C.ink};font-variant-numeric:tabular-nums}
.vs{font-size:12px;fill:${C.ink3};font-variant-numeric:tabular-nums}
.cat{font-size:13.5px;fill:${C.ink2}}
.ph{font-size:14px;font-weight:500;fill:${C.ink}}
.halo{paint-order:stroke;stroke:#fff;stroke-width:4px;stroke-linejoin:round}
.cross{stroke:${C.ink};stroke-width:1;stroke-opacity:.35}
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
const tmonth = t => `${MON[t % 12]} ${Math.floor(t / 12)}`;
const pts = (dates, vals) => dates.map((d, i) => ({d, t:mi(d), v:vals[i]})).filter(p => p.v != null);
const cv = document.createElement("canvas").getContext("2d");
const tw = (s, font = "12px 'Golos Text'") => { cv.font = font; return cv.measureText(s).width; };
function niceTicks(lo, hi, n = 5) {
  const raw = (hi - lo) / n || 1, p = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = [1, 2, 5, 10].map(k => k * p).find(s => s >= raw);
  const t = []; for (let v = Math.floor(lo / step + 1e-9) * step; v < hi + step - 1e-9; v += step) t.push(+v.toFixed(6));
  return {t, step};
}
const fmtTick = (v, step) => num(v, step % 1 ? 1 : 0);
const RM = matchMedia("(prefers-reduced-motion: reduce)").matches;

/* find a horizontal slot for a label along y=ly, clear of every point of every series */
function freeSlot(x0, x1, ly, w, series, x, y, pad = 11, prefer = "left") {
  const xs = []; for (let a = x0; a + w <= x1; a += 3) xs.push(a);
  if (prefer === "right") xs.reverse();
  return xs.find(a => series.every(P => P.every((p, i) => {
    const px = x(p.t); if (px < a - 6 || px > a + w + 6) {
      const q = P[i + 1]; if (!q) return true;           // also test the segment between points
      const qx = x(q.t); if ((px < a && qx < a) || (px > a + w && qx > a + w)) return true;
      const tt = Math.max(0, Math.min(1, ((a + w / 2) - px) / ((qx - px) || 1))); return Math.abs(y(p.v + (q.v - p.v) * tt) - ly) > pad;
    }
    return Math.abs(y(p.v) - ly) > pad;
  }))) ?? null;
}

/* ---------- line chart ---------- */
function line(host, W, o, exp) {
  const narrow = W < 600, H = o.h ? o.h(W) : (narrow ? 290 : 400);
  const m = {l:30, r: o.endLabels ? (narrow ? 72 : 108) : 12, t:16, b:30};
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

  if (o.band) {
    S("rect", {x:m.l, width:W - m.l - m.r, y:y(o.band[1]), height:y(o.band[0]) - y(o.band[1]), fill:C.wash}, svg);
  }
  ticks.forEach((v, i) => {
    S("line", {x1:m.l, x2:W - m.r, y1:y(v), y2:y(v), class: v === 0 ? "base" : "grid"}, svg);
    T(svg, m.l - 9, y(v) + 4, fmtTick(v, step) + (i === ticks.length - 1 && o.unit ? o.unit : ""), {class:"yl", "text-anchor":"end"});
  });
  if (o.band) [o.band[0], o.band[1]].forEach(b => S("line", {x1:m.l, x2:W - m.r, y1:y(b), y2:y(b), stroke:C.washEdge, "stroke-width":1}, svg));
  if (o.target != null) S("line", {x1:m.l, x2:W - m.r, y1:y(o.target), y2:y(o.target), stroke:C.blue, "stroke-opacity":.55, "stroke-width":1, "stroke-dasharray":"1.5 3", "stroke-linecap":"round"}, svg);

  // x axis
  const span = t1 - t0;
  if (span <= 15) {
    for (let t = t0; t <= t1; t++) T(svg, x(t), H - 9, narrow ? M3[t % 12].slice(0, 1) === "J" && span > 8 ? M3[t % 12] : M3[t % 12] : M3[t % 12], {class:"xl", "text-anchor": t === t0 ? "start" : t === t1 ? "end" : "middle"});
  } else {
    const yrs = []; for (let yv = Math.ceil(t0 / 12); yv * 12 <= t1; yv++) yrs.push(yv);
    const per = (W - m.l - m.r) / (span / 12), every = per < 30 ? 4 : per < 44 ? 3 : per < 62 ? 2 : 1;
    yrs.forEach(yv => { if ((yrs.at(-1) - yv) % every) return;
      const xx = x(yv * 12);
      S("line", {x1:xx, x2:xx, y1:H - m.b, y2:H - m.b + 4, class:"base"}, svg);
      T(svg, xx, H - 9, String(yv), {class:"xl", "text-anchor": xx - m.l < 16 ? "start" : "middle"}); });
  }
  if (o.under) o.under(g);
  // gap wash between two series, where the first runs above the second
  if (o.gap) {
    const [A, B] = o.gap.map(i => all[i].p);
    const d = A.map((p, i) => `${i ? "L" : "M"}${x(p.t)},${y(Math.max(p.v, B[i].v))}`).join("") + B.slice().reverse().map(p => `L${x(p.t)},${y(p.v)}`).join("") + "Z";
    S("path", {d, fill:C.goldWash}, svg);
  }
  const path = arr => arr.map((p, i) => `${i ? "L" : "M"}${x(p.t).toFixed(2)},${y(p.v).toFixed(2)}`).join("");
  const draws = [];
  for (const s of all) {
    const w = s.w || 2;
    if (s.liveFrom && s.p[0].t < mi(s.liveFrom)) {
      const k = s.p.findIndex(p => p.t >= mi(s.liveFrom));
      draws.push(S("path", {d:path(s.p.slice(0, k + 1)), fill:"none", stroke:s.color, "stroke-opacity":.34, "stroke-width":1.4, "stroke-linejoin":"round", "stroke-linecap":"round"}, svg));
      draws.push(S("path", {d:path(s.p.slice(k)), fill:"none", stroke:s.color, "stroke-width":w, "stroke-linejoin":"round", "stroke-linecap":"round"}, svg));
    } else draws.push(S("path", {d:path(s.p), fill:"none", stroke:s.color, "stroke-width":w, "stroke-linejoin":"round", "stroke-linecap":"round", "stroke-opacity":s.op ?? 1}, svg));
  }
  if (o.over) o.over(g);
  // end markers and labels, dodged so they never touch
  const ends = [];
  if (o.endLabels) {
    const L = all.filter(s => !s.noEnd).map(s => ({s, p:s.p.at(-1), y:y(s.p.at(-1).v)})).sort((a, b) => a.y - b.y);
    for (let i = 1; i < L.length; i++) if (L[i].y - L[i - 1].y < 32) L[i].y = L[i - 1].y + 32;
    for (const l of L) {
      const ex = x(l.p.t), ey = y(l.p.v);
      ends.push(S("circle", {cx:ex, cy:ey, r:8, fill:l.s.color, "fill-opacity":.13}, svg));
      ends.push(S("circle", {cx:ex, cy:ey, r:3.6, fill:l.s.color, stroke:"#fff", "stroke-width":1.75}, svg));
      ends.push(T(svg, ex + 13, l.y + 1, `${num(l.p.v, l.s.dp ?? 2)}${l.s.unit ?? "%"}`, {class:"ev"}));
      ends.push(T(svg, ex + 13, l.y + 16, l.s.endName || monS(l.p.d), {class:"ed"}));
    }
  }
  if (exp) return svg;
  // the one orchestrated moment: lines draw in when the chart first comes into view
  if (!RM && o.animate) {
    draws.forEach(p => { const L = p.getTotalLength(); p.style.strokeDasharray = L; p.style.strokeDashoffset = L; });
    ends.forEach(e => e.style.opacity = 0);
    const io = new IntersectionObserver(es => { if (!es[0].isIntersecting) return; io.disconnect();
      draws.forEach(p => { p.style.transition = "stroke-dashoffset 1100ms cubic-bezier(.3,.6,.2,1)"; p.style.strokeDashoffset = 0; });
      ends.forEach(e => { e.style.transition = "opacity 300ms ease 1000ms"; e.style.opacity = 1; }); }, {threshold:.35});
    io.observe(svg);
  }
  // scrubbing
  const cross = S("line", {y1:m.t, y2:H - m.b, class:"cross", visibility:"hidden"}, svg);
  const rings = all.map(s => S("circle", {r:4.5, fill:"#fff", stroke:s.color, "stroke-width":2, visibility:"hidden"}, svg));
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

/* an annotation: a ring on the point, an elbow leader, a bold first line and a quiet second */
function note(g, {t, v, title, text, side = "left", drop = 0}) {
  const {x, y, svg, narrow} = g, px = x(t), py = y(v);
  const tx = side === "left" ? px - 14 : px + 14, ty = py + drop;
  S("circle", {cx:px, cy:py, r:3.5, fill:"#fff", stroke:C.ink, "stroke-width":1.25}, svg);
  S("path", {d:`M${px},${py + (drop > 0 ? 4 : -4)}V${ty - 4}H${tx + (side === "left" ? 4 : -4)}`, class:"lead"}, svg);
  T(svg, tx, ty, title, {class:"nt halo", "text-anchor": side === "left" ? "end" : "start"});
  if (text && !narrow) T(svg, tx, ty + 16, text, {class:"nb halo", "text-anchor": side === "left" ? "end" : "start"});
}

/* ---------- dumbbell: last month to this month ---------- */
function dumbbell(host, W, o, exp) {
  const narrow = W < 600, rows = o.rows, cap = o.cap, maxV = Math.max(...rows.flatMap(r => [r.a, r.b]));
  const lab = narrow ? 0 : 236, right = narrow ? 64 : 92, top = 30, rowH = narrow ? 50 : 34;
  const H = top + rows.length * rowH + 26;
  const svg = S("svg", {width:W, height:H, viewBox:`0 0 ${W} ${H}`, role:"img", "aria-label":o.aria}, host);
  const x1 = W - right, brk = 22, seg = narrow ? 44 : 72, segEnd = x1, capX = x1 - brk - seg;
  const x = v => v <= cap ? lab + v / cap * (capX - lab) : capX + brk + (v - cap) / (maxV - cap) * (segEnd - capX - brk);
  const {t:ticks} = niceTicks(0, cap, narrow ? 4 : 4);
  ticks.filter(v => v <= cap).forEach(v => {
    S("line", {x1:x(v), x2:x(v), y1:top - 6, y2:H - 24, class: v ? "grid" : "base"}, svg);
    T(svg, x(v), H - 7, v === ticks.filter(q => q <= cap).at(-1) ? v + "%" : String(v), {class:"xl", "text-anchor":"middle"});
  });
  // the axis break, honestly marked
  const bx = capX + brk / 2;
  S("path", {d:`M${bx - 5},${H - 18}L${bx - 1},${H - 30}M${bx + 1},${H - 18}L${bx + 5},${H - 30}`, stroke:C.ink3, "stroke-width":1}, svg);
  T(svg, x(maxV), H - 7, num(maxV, 0) + "%", {class:"xl", "text-anchor":"middle"});
  if (o.ref != null) {
    const rx = x(o.ref);
    S("line", {x1:rx, x2:rx, y1:top - 6, y2:H - 24, stroke:C.ink, "stroke-width":1, "stroke-dasharray":"1.5 3", "stroke-linecap":"round"}, svg);
    T(svg, rx, top - 13, o.refLabel, {class:"nt", "text-anchor":"middle"});
  }
  rows.forEach((r, j) => {
    const yy = top + j * rowH + (narrow ? 30 : 13);
    if (narrow) T(svg, 0, yy - 13, r.n, {class:"cat halo", style:"font-size:13px"});
    else T(svg, lab - 16, yy + 4.5, r.n, {class:"cat", "text-anchor":"end"});
    const xa = x(r.a), xb = x(r.b), brokenRow = r.a > cap || r.b > cap;
    S("line", {x1:Math.min(xa, xb), x2:Math.max(xa, xb), y1:yy, y2:yy, stroke: r.b >= r.a ? C.blueSoft : C.base, "stroke-width":2.5, "stroke-linecap":"round"}, svg);
    S("circle", {cx:xa, cy:yy, r:4, fill:"#fff", stroke:C.ink3, "stroke-width":1.5}, svg);
    S("circle", {cx:xb, cy:yy, r:5, fill:C.blue, stroke:"#fff", "stroke-width":1.5}, svg);
    const vx = Math.max(xa, xb) + 12;
    if (brokenRow) { T(svg, Math.min(xa, xb) - 12, yy + 4.5, `${num(r.b)}%`, {class:"vl halo", "text-anchor":"end"}); }
    else {
      T(svg, vx, yy + 4.5, `${num(r.b)}%`, {class:"vl halo"});
      if (!narrow) T(svg, vx + tw(`${num(r.b)}%`, "600 13px 'Golos Text'") + 6, yy + 4.5, sgn(r.b - r.a), {class:"vs halo"});
    }
  });
  return svg;
}

/* ---------- heat table: rows × months ---------- */
function heat(host, W, o, exp) {
  const narrow = W < 600, lab = narrow ? 128 : 236, cols = o.cols.length, top = 28;
  const cw = (W - lab) / cols, ch = narrow ? 30 : 34, H = top + o.rows.length * ch + 6;
  const svg = S("svg", {width:W, height:H, viewBox:`0 0 ${W} ${H}`, role:"img", "aria-label":o.aria}, host);
  o.cols.forEach((c, i) => T(svg, lab + i * cw + cw / 2, top - 12, c, {class:"xl", "text-anchor":"middle", style: i === cols - 1 ? `fill:${C.ink};font-weight:600` : ""}));
  o.rows.forEach((r, j) => {
    const yy = top + j * ch;
    T(svg, lab - 14, yy + ch / 2 + 4.5, narrow ? (r.short || r.n) : r.n, {class:"cat", "text-anchor":"end", style: narrow ? "font-size:12.5px" : ""});
    r.v.forEach((v, i) => {
      const b = o.bin(v);
      S("rect", {x:lab + i * cw + 1, y:yy + 1, width:cw - 2, height:ch - 2, fill:RAMP[b], rx:1.5}, svg);
      T(svg, lab + i * cw + cw / 2, yy + ch / 2 + 4.5, Math.abs(v) < .05 ? "0.0" : num(v, 1), {"text-anchor":"middle", style:`font-size:${narrow ? 12 : 13}px;font-variant-numeric:tabular-nums;fill:${b >= 3 ? "#fff" : C.ink};font-weight:${i === cols - 1 ? 600 : 400}`});
    });
  });
  return svg;
}

/* ---------- diverging bars around zero ---------- */
function diverging(host, W, o, exp) {
  const narrow = W < 600, rows = o.rows, lab = narrow ? 112 : 190, top = 8, rowH = narrow ? 30 : 30, bh = narrow ? 10 : 11;
  const H = top + rows.length * rowH + 26;
  const svg = S("svg", {width:W, height:H, viewBox:`0 0 ${W} ${H}`, role:"img", "aria-label":o.aria}, host);
  const lo = Math.min(0, ...rows.map(r => r.v)), hi = Math.max(0, ...rows.map(r => r.v));
  const {t:ticks} = niceTicks(lo, hi, narrow ? 4 : 7);
  const pad = narrow ? 50 : 62, x0 = lab + pad, x1 = W - pad;
  const x = v => x0 + (v - ticks[0]) / (ticks.at(-1) - ticks[0]) * (x1 - x0);
  ticks.forEach(v => { S("line", {x1:x(v), x2:x(v), y1:top - 2, y2:H - 22, class: v === 0 ? "base" : "grid"}, svg);
    T(svg, x(v), H - 6, (v > 0 ? "+" : "") + num(v, 0) + (v === ticks.at(-1) ? "%" : ""), {class:"xl", "text-anchor":"middle"}); });
  rows.forEach((r, j) => {
    const yy = top + j * rowH + (rowH - bh) / 2, pos = r.v >= 0, col = pos ? C.blue : C.gold;
    T(svg, lab - 2, yy + bh - 1, r.n, {class:"cat", "text-anchor":"end", style: narrow ? "font-size:12.5px" : ""});
    const xa = x(0), xb = x(r.v), w = Math.abs(xb - xa);
    S("path", {d: pos ? `M${xa},${yy}h${Math.max(0, w - 2)}a2,2 0 0 1 2,2v${bh - 4}a2,2 0 0 1 -2,2h${-Math.max(0, w - 2)}Z`
                      : `M${xa},${yy}h${-Math.max(0, w - 2)}a2,2 0 0 0 -2,2v${bh - 4}a2,2 0 0 0 2,2h${Math.max(0, w - 2)}Z`, fill:col}, svg);
    T(svg, pos ? xb + 7 : xb - 7, yy + bh - 1, (r.v > 0 ? "+" : "") + num(r.v, 1), {class:"vl halo", "text-anchor": pos ? "start" : "end", style:"font-size:12.5px"});
  });
  return svg;
}

/* ---------- tile map + ranked list ---------- */
function tiles(host, W, o, exp) {
  const side = W >= 1000, cell = 60, gap = 4, cols = 9, rows = 7;
  const mapW = Math.min(side ? 560 : 600, W), sc = mapW / (cols * cell), mapH = rows * cell * sc;
  const lcols = side ? 2 : W >= 700 ? 3 : 2;
  const listTop = side ? 0 : mapH + 64, perCol = Math.ceil(o.list.length / lcols), lh = side ? Math.max(19, (mapH + 40) / perCol) : 23;
  const listH = perCol * lh;
  const H = side ? Math.max(mapH + 48, listH + 4) : listTop + listH + 4;
  const svg = S("svg", {width:W, height:H, viewBox:`0 0 ${W} ${H}`, role:"img", "aria-label":o.aria}, host);
  const gm = S("g", {transform:`scale(${sc})`}, svg), big = sc < .72;
  for (const k in o.tiles) {
    const [code, cx, cy] = o.tiles[k], v = o.val(k), b = o.bin(v);
    const g = S("g", {transform:`translate(${cx * cell},${cy * cell})`}, gm);
    S("rect", {width:cell - gap, height:cell - gap, fill:RAMP[b], rx:2}, g);
    const fg = b >= 3 ? "#fff" : C.ink;
    T(g, 7, big ? 23 : 19, code, {style:`font-size:${big ? 18 : 13}px;font-weight:600;fill:${fg}`});
    T(g, 7, cell - gap - (big ? 8 : 9), big ? v.toFixed(1) : num(v), {style:`font-size:${big ? 17 : 12.5}px;fill:${fg};font-variant-numeric:tabular-nums`});
    if (!exp) { const tt = S("title", {}, g); tt.textContent = `${o.name(k)}: ${num(v)}%`; }
  }
  // legend
  const ly = mapH + 24;
  T(svg, 0, ly + 9, "Per cent", {class:"labq"});
  const lx = 62, sw = 36;
  RAMP.forEach((r, i) => S("rect", {x:lx + i * sw, y:ly, width:sw - 2, height:9, fill:r, rx:1}, svg));
  o.binLabels.forEach((t, i) => T(svg, lx + (i + 1) * sw - 1, ly + 25, t, {class:"labq", "text-anchor":"middle"}));
  // ranked list
  const lx0 = side ? mapW + 48 : 0, colW = ((side ? W - lx0 : W) - 28 * (lcols - 1)) / lcols;
  o.list.forEach((r, i) => {
    const c = Math.floor(i / perCol), yy = listTop + (i % perCol) * lh + 14, xx = lx0 + c * (colW + 28);
    S("line", {x1:xx, x2:xx + colW, y1:yy + 6, y2:yy + 6, class:"grid"}, svg);
    const SH = {"Andaman and Nicobar":"Andaman and N.", "Dadra, Daman and Diu":"Dadra and Daman", "Jammu and Kashmir":"J and K", "Arunachal Pradesh":"Arunachal", "Himachal Pradesh":"Himachal", "Madhya Pradesh":"MP", "Uttar Pradesh":"UP"};
    const nm = tw(r.n, "13px 'Golos Text'") > colW - 44 && SH[r.n] ? SH[r.n] : r.n;
    T(svg, xx, yy, nm, {class:"cat", style:`font-size:13px;${r.hl ? `fill:${C.blue};font-weight:600` : ""}`});
    T(svg, xx + colW, yy, num(r.v), {class:"vl", "text-anchor":"end", style:`font-size:13px;${r.hl ? `fill:${C.blue}` : ""}`});
  });
  return svg;
}

/* ---------- small multiples with a context line ---------- */
function multiples(host, W, o, exp) {
  const cols = W < 600 ? 2 : 3, gx = W < 600 ? 20 : 40, pw = (W - gx * (cols - 1)) / cols, ph = W < 600 ? 104 : 124, head = 44, gy = 34;
  const rowsN = Math.ceil(o.panels.length / cols), H = rowsN * (head + ph) + (rowsN - 1) * gy + 4;
  const svg = S("svg", {width:W, height:H, viewBox:`0 0 ${W} ${H}`, role:"img", "aria-label":o.aria}, host);
  const [lo, hi] = o.domain, ticks = o.ticks;
  const P = [];
  o.panels.forEach((pn, j) => {
    const ox = (j % cols) * (pw + gx), oy = Math.floor(j / cols) * (head + ph + gy);
    const g = S("g", {transform:`translate(${ox},${oy})`}, svg);
    const pp = pts(o.dates, pn.vals), ctx = pts(o.dates, o.context.vals), t0 = pp[0].t, t1 = pp.at(-1).t, last = pp.at(-1);
    const ml = j % cols === 0 ? 28 : 4;
    const x = t => ml + (t - t0) / (t1 - t0) * (pw - ml - 8), y = v => head + 4 + (hi - v) / (hi - lo) * (ph - 26);
    T(g, 0, 14, pn.n, {class:"ph"});
    const hv = T(g, 0, 35, `${num(last.v)}%`, {class:"ev", style:"font-size:16px"});
    const hd = T(g, tw(`${num(last.v)}%`, "600 16px 'Golos Text'") + 7, 35, monS(last.d), {class:"ed"});
    ticks.forEach(v => { S("line", {x1:ml, x2:pw - 8, y1:y(v), y2:y(v), class: v === 0 ? "base" : "grid"}, g);
      if (j % cols === 0) T(g, ml - 7, y(v) + 4, v > 0 ? "+" + v : num(v, 0), {class:"yl", "text-anchor":"end", style:"font-size:11px"}); });
    o.years.forEach(yv => { if (yv * 12 >= t0 && yv * 12 <= t1) T(g, x(yv * 12), head + ph - 2, String(yv), {class:"xl", "text-anchor":"middle", style:"font-size:11px"}); });
    S("path", {d:ctx.filter(p => p.t >= t0).map((p, i) => `${i ? "L" : "M"}${x(p.t).toFixed(1)},${y(p.v).toFixed(1)}`).join(""), fill:"none", stroke:C.ink4, "stroke-width":1.1, "stroke-linejoin":"round"}, g);
    S("path", {d:pp.map((p, i) => `${i ? "L" : "M"}${x(p.t).toFixed(1)},${y(p.v).toFixed(1)}`).join(""), fill:"none", stroke:C.blue, "stroke-width":1.75, "stroke-linejoin":"round"}, g);
    S("circle", {cx:x(last.t), cy:y(last.v), r:3.25, fill:C.blue, stroke:"#fff", "stroke-width":1.5}, g);
    P.push({g, x, y, pp, hv, hd, last, ml, ox, oy, t0, t1});
  });
  if (exp) return svg;
  P.forEach(pn => { pn.cross = S("line", {y1:head + 4, y2:head + ph - 22, class:"cross", visibility:"hidden"}, pn.g);
    pn.ring = S("circle", {r:4, fill:"#fff", stroke:C.blue, "stroke-width":1.75, visibility:"hidden"}, pn.g); });
  const sync = t => P.forEach(pn => { const p = t == null ? null : pn.pp.find(q => q.t === t);
    const show = p || pn.last;
    pn.hv.textContent = `${num(show.v)}%`; pn.hd.textContent = monS(show.d); pn.hd.setAttribute("x", tw(`${num(show.v)}%`, "600 16px 'Golos Text'") + 7);
    [pn.cross, pn.ring].forEach(e => e.setAttribute("visibility", p ? "visible" : "hidden"));
    if (p) { pn.cross.setAttribute("x1", pn.x(t)); pn.cross.setAttribute("x2", pn.x(t)); pn.ring.setAttribute("cx", pn.x(t)); pn.ring.setAttribute("cy", pn.y(p.v)); } });
  const hit = S("rect", {x:0, y:0, width:W, height:H, fill:"transparent"}, svg);
  hit.addEventListener("pointermove", e => { const r = svg.getBoundingClientRect(), px = e.clientX - r.left, py = e.clientY - r.top;
    const pn = P.find(q => px >= q.ox && px <= q.ox + pw && py >= q.oy && py <= q.oy + head + ph); if (!pn) return sync(null);
    let b = pn.pp[0]; pn.pp.forEach(p => { if (Math.abs(pn.x(p.t) - (px - pn.ox)) < Math.abs(pn.x(b.t) - (px - pn.ox))) b = p; }); sync(b.t); });
  hit.addEventListener("pointerleave", () => sync(null));
  return svg;
}

/* ---------- a word-sized chart for indexes and lists ---------- */
function mini(dates, vals, {w = 132, h = 40, color = C.blue, kind = "line", zero = false} = {}) {
  const P = pts(dates, vals); if (!P.length) return "";
  const lo = Math.min(zero ? 0 : Infinity, ...P.map(p => p.v)), hi = Math.max(...P.map(p => p.v));
  const t0 = P[0].t, t1 = P.at(-1).t;
  const x = t => 3 + (t - t0) / Math.max(1, t1 - t0) * (w - 10), y = v => 4 + (hi - v) / ((hi - lo) || 1) * (h - 9);
  if (kind === "slope") {
    const a = P[0], b = P.at(-1);
    return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" aria-hidden="true"><line x1="${x(a.t)}" x2="${x(b.t)}" y1="${y(a.v)}" y2="${y(b.v)}" stroke="${C.blueSoft}" stroke-width="2"/>
      <circle cx="${x(a.t)}" cy="${y(a.v)}" r="3.5" fill="#fff" stroke="${C.ink3}" stroke-width="1.5"/><circle cx="${x(b.t)}" cy="${y(b.v)}" r="4" fill="${color}" stroke="#fff" stroke-width="1.5"/></svg>`;
  }
  const d = P.map((p, i) => `${i ? "L" : "M"}${x(p.t).toFixed(1)},${y(p.v).toFixed(1)}`).join("");
  const zl = lo < 0 && hi > 0 ? `<line x1="2" x2="${w - 4}" y1="${y(0)}" y2="${y(0)}" stroke="${C.base}"/>` : "";
  return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" aria-hidden="true">${zl}<path d="${d}" fill="none" stroke="${color}" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round"/><circle cx="${x(P.at(-1).t)}" cy="${y(P.at(-1).v)}" r="2.75" fill="${color}" stroke="#fff" stroke-width="1.25"/></svg>`;
}

/* ---------- band position scale for the current reading ---------- */
function bandScale(host, W, {v, band, target, max}) {
  const H = 64, l = 4, r = 4, x = q => l + q / max * (W - l - r);
  const svg = S("svg", {width:W, height:H, viewBox:`0 0 ${W} ${H}`, role:"img", "aria-label":`${num(v)}% against the RBI band of ${band[0]} to ${band[1]}%`}, host);
  S("rect", {x:x(band[0]), y:22, width:x(band[1]) - x(band[0]), height:10, fill:C.wash}, svg);
  S("line", {x1:x(0), x2:x(max), y1:27, y2:27, stroke:C.base}, svg);
  [band[0], band[1]].forEach(b => S("line", {x1:x(b), x2:x(b), y1:20, y2:34, stroke:C.washEdge, "stroke-width":1.5}, svg));
  S("line", {x1:x(target), x2:x(target), y1:16, y2:38, stroke:C.blue, "stroke-opacity":.6, "stroke-dasharray":"1.5 2.5"}, svg);
  for (let q = 0; q <= max; q += 2) T(svg, x(q), 56, q + (q === max ? "%" : ""), {class:"xl", "text-anchor": q === 0 ? "start" : q === max ? "end" : "middle"});
  S("circle", {cx:x(v), cy:27, r:10, fill:C.blue, "fill-opacity":.13}, svg);
  S("circle", {cx:x(v), cy:27, r:5, fill:C.blue, stroke:"#fff", "stroke-width":2}, svg);
  T(svg, x(target), 10, "Target", {class:"labq", "text-anchor":"middle"});
  return svg;
}

/* ---------- the card: title, controls, chart, source, export ---------- */
const REG = {};
function card(spec) {
  const el = document.getElementById(spec.id); if (!el) return;
  REG[spec.id] = spec; spec.el = el; el.classList.add("card");
  el.innerHTML = `<header><h3>${spec.title}</h3><p class="sub">${spec.sub}</p></header>
    <div class="bar">${spec.ranges ? `<div class="ranges" role="group" aria-label="Time range">${spec.ranges.map(([l], i) => `<button type="button" aria-pressed="${i === spec.ranges.length - 1}" data-i="${i}">${l}</button>`).join("")}</div>`
      : spec.key ? `<div class="key">${spec.key.map(([l, col, kind]) => `<span><i class="${kind || ""}" style="--c:${col}"></i>${l}</span>`).join("")}</div>` : "<div></div>"}
      ${spec.readout ? `<div class="readout" aria-live="polite"></div>` : ""}</div>
    <div class="plot"></div>
    <figcaption class="cf"><div class="srcs">${spec.source}</div>
      <div class="acts"><button type="button" data-a="png">Image</button><button type="button" data-a="svg">SVG</button><button type="button" data-a="csv">Data</button><button type="button" data-a="link">Link</button><button type="button" data-a="embed">Embed</button></div></figcaption>`;
  spec.state = {from: spec.ranges ? spec.ranges.at(-1)[1] : 0, drawn:false};
  const ro = el.querySelector(".readout");
  if (ro) spec.state.readout = t => { const [a, b] = spec.readout(t ?? spec.lastT); ro.innerHTML = `<span>${a}</span><b>${b}</b>`; };
  if (spec.ranges) el.querySelectorAll(".ranges button").forEach(b => b.addEventListener("click", () => {
    el.querySelectorAll(".ranges button").forEach(q => q.setAttribute("aria-pressed", q === b));
    spec.state.from = spec.ranges[+b.dataset.i][1]; draw(spec, true); }));
  el.querySelectorAll(".acts button").forEach(b => b.addEventListener("click", () => act(spec, b.dataset.a, b)));
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

/* ---------- export ---------- */
let FONTS = null;
async function fontCSS() {
  if (FONTS != null) return FONTS;
  try {
    const css = await (await fetch("https://fonts.googleapis.com/css2?family=Golos+Text:wght@400;500;600&family=Source+Serif+4:opsz,wght@8..60,600&display=swap")).text();
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
  const Wd = 1200, P = 60, inner = Wd - 2 * P, parts = [];
  let yy = P + 30;
  wrap(strip(spec.title), "600 36px 'Source Serif 4'", inner).forEach(l => { parts.push(`<text x="${P}" y="${yy}" style="font:600 36px 'Source Serif 4',serif;fill:${C.ink};letter-spacing:-.012em">${esc(l)}</text>`); yy += 44; });
  yy += 2;
  wrap(strip(spec.sub), "400 18px 'Golos Text'", inner).forEach(l => { parts.push(`<text x="${P}" y="${yy}" style="font:400 18px 'Golos Text';fill:${C.ink2}">${esc(l)}</text>`); yy += 27; });
  yy += 20;
  if (spec.key) { let kx = P; for (const [l, col, kind] of spec.key) {
    if (kind === "sq") parts.push(`<rect x="${kx}" y="${yy - 10}" width="11" height="11" rx="1.5" fill="${col}"/>`);
    else if (kind === "ring") parts.push(`<circle cx="${kx + 5}" cy="${yy - 4.5}" r="4" fill="#fff" stroke="${col}" stroke-width="1.5"/>`);
    else if (kind === "dot") parts.push(`<circle cx="${kx + 5}" cy="${yy - 4.5}" r="5" fill="${col}"/>`);
    else parts.push(`<rect x="${kx}" y="${yy - 6}" width="18" height="2.5" rx="1.25" fill="${col}"/>`);
    const off = kind === "sq" || kind === "ring" || kind === "dot" ? 18 : 26;
    parts.push(`<text x="${kx + off}" y="${yy}" style="font:400 15px 'Golos Text';fill:${C.ink2}">${esc(l)}</text>`);
    kx += off + tw(l, "15px 'Golos Text'") + 28; } yy += 26; }
  const tmp = document.createElement("div"); tmp.style.cssText = `position:absolute;left:-99999px;top:0;width:${inner}px`; document.body.appendChild(tmp);
  const chart = spec.draw(tmp, inner, true, {...spec.state, animate:false});
  const ch = +chart.getAttribute("height");
  const xml = new XMLSerializer().serializeToString(chart).replace(/^<svg[^>]*>/, "").replace(/<\/svg>$/, "");
  tmp.remove();
  parts.push(`<g transform="translate(${P},${yy})">${xml}</g>`);
  yy += ch + 30;
  parts.push(`<line x1="${P}" x2="${Wd - P}" y1="${yy}" y2="${yy}" stroke="#E3E6EB"/>`);
  yy += 26;
  const src = wrap(strip(spec.source), "400 14px 'Golos Text'", inner - 250);
  src.forEach((l, i) => parts.push(`<text x="${P}" y="${yy + i * 20}" style="font:400 14px 'Golos Text';fill:${C.ink3}">${esc(l)}</text>`));
  parts.push(`<text x="${Wd - P}" y="${yy + 3}" text-anchor="end" style="font:600 20px 'Source Serif 4',serif;fill:${C.ink}">India Atlas</text>`);
  parts.push(`<text x="${Wd - P}" y="${yy + 23}" text-anchor="end" style="font:400 13px 'Golos Text';fill:${C.ink3}">atlas.thisindianlife.today</text>`);
  yy += Math.max(src.length * 20, 30) + P - 14;
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
  if (a === "png") { flash(b, "Preparing"); dl(await png(spec), spec.file + ".png"); flash(b, "Downloaded"); }
  if (a === "svg") { dl(new Blob([(await build(spec)).svg], {type:"image/svg+xml"}), spec.file + ".svg"); flash(b, "Downloaded"); }
  if (a === "csv") { dl(new Blob([spec.csv() + "\n"], {type:"text/csv"}), spec.file + ".csv"); flash(b, "Downloaded"); }
  if (a === "link") flash(b, (await copy(location.href.split("#")[0] + "#" + spec.id)) ? "Link copied" : "Copy failed");
  if (a === "embed") flash(b, (await copy(`<iframe src="https://atlas.thisindianlife.today/embed/${spec.id}" title="${strip(spec.title).replace(/"/g, "&quot;")}" width="100%" height="580" style="border:0"></iframe>`)) ? "Code copied" : "Copy failed");
}

/* page styles for chart text */
const st = document.createElement("style"); st.textContent = CSS.trim().split("\n").map(r => ".plot " + r).join("\n"); document.head.appendChild(st);

window.Kit = {C, RAMP, S, T, num, sgn, grp, MON, M3, mi, month, monS, tmonth, pts, tw, niceTicks, freeSlot, line, note, dumbbell, heat, diverging, tiles, multiples, mini, bandScale, card, build, REG};
})();
