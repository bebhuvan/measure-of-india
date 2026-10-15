// src/charts/plot.js: shared Observable Plot entry, aliased by astro.config.mjs.
// Below 700 px, charts authored at least 600 px wide receive a phone layout.
// Category rows use complete wrapped names above their marks. Supported facets
// stack vertically and short categorical columns fit the available width.
// Continuous and time plots retain their observations and domains while using
// phone width and fewer axis ticks. Year columns/facets and unsupported matrices
// retain their authored layout. Family-authored compact charts and narrow:false
// bypass this wrapper unless narrow:true explicitly opts a compact panel in.
// See DESIGN.md §0.4a; rendered geometry still needs QA.
//
// The imports below name Plot's own entry by path: the package name itself is the alias.
import * as P from "../../node_modules/@observablehq/plot/src/index.js";
export * from "../../node_modules/@observablehq/plot/src/index.js";

export const NARROW_BELOW = 700;   // viewport px; the site's phone breakpoint for plates
const DOT_BAND = 18;               // px of a row the marks take on a point scale (dot strips)
const GUTTER = 20;                 // the page gutter on a phone (atlas.css --gutter)

function viewport() {
  if (typeof window === "undefined") return Infinity;
  return window.innerWidth || window.document?.documentElement?.clientWidth || Infinity;
}

// Wrap complete category names; visible labels must not depend on hover or aria text.
export function narrowNameLines(text, width) {
  const max=Math.max(16,Math.floor((width-28)/(12*0.6)));
  const words=String(text).trim().split(/\s+/), lines=[];
  let line='';
  for(const word of words){
    if(word.length>max){
      if(line){lines.push(line);line='';}
      let remaining=word;
      while(remaining.length>max){lines.push(remaining.slice(0,max));remaining=remaining.slice(max);}
      line=remaining;
    }else if(line && line.length+1+word.length>max){lines.push(line);line=word;}
    else line=line?line+' '+word:word;
  }
  if(line)lines.push(line);
  return lines.length?lines:[''];
}
function namesAbove(names,width,band){
  const lines=names.map(n=>narrowNameLines(n,width));
  const count=Math.max(...lines.map(l=>l.length));
  return {height:count*15+11,marks:Array.from({length:count},(_,i)=>P.text(names,{
    y:d=>d,text:(_,j)=>lines[j][i]??'',frameAnchor:'left',textAnchor:'start',
    dy:-(band/2)-9-(count-i-1)*15,fontSize:12,fill:'#262B35',className:'rowname'
  }))};
}

// an x-axis label ("US$ billion, in the quarter") on its own line under the tick values, so the
// two never share a line at phone width
function xLabelRoom(x, marginBottom) {
  if (!x.label || x.axis === null) return marginBottom;
  const top = x.axis === "top";
  if (top) return marginBottom;
  x.labelOffset = marginBottom + 6; x.labelAnchor = x.labelAnchor ?? "right";
  return marginBottom + 20;
}

const QUANT = new Set(["linear", "log", "sqrt", "pow", "symlog", "utc", "time"]);

export function plot(options = {}) {
  const fig = options.narrow === false ? P.plot(options) : fitAxes(options, options.width ?? 640, false);
  const vw = viewport();
  if (options.narrow === false || !(vw < NARROW_BELOW)) return fig;
  if ((options.width ?? 640) < 600 && options.narrow !== true) return fig;
  const fxs = fig.scale?.("fx"), fys = fig.scale?.("fy");
  if (fxs || fys) return facets(options, fig, fxs, fys, vw);
  const ys = fig.scale?.("y"), xs = fig.scale?.("x");
  if (xs && ys && QUANT.has(xs.type) && QUANT.has(ys.type)) return continuous(options, fig, xs, vw);
  if (xs && ys && (xs.type === "band" || xs.type === "point") && QUANT.has(ys.type)) return columns(options, fig, xs, vw);
  if (!ys || (ys.type !== "band" && ys.type !== "point") || !xs || !QUANT.has(xs.type)) return fig;
  const names = ys.domain;
  if (!names?.length) return fig;

  const width = Math.max(280, Math.min(vw, 760) - 2 * GUTTER);
  // the marks keep the thickness they were authored at (grouped bars drawn with insets need it);
  // the row adds a line for the name above them
  const band = ys.type === "band" ? Math.max(14, Math.min(44, ys.bandwidth || DOT_BAND)) : Math.max(DOT_BAND, Math.min(48, (ys.step || 0) * 0.9));
  const annotationBand = Math.max(band, 64);
  const nameRows=namesAbove(names,width,annotationBand);
  const ROW = annotationBand + nameRows.height;
  const marginTop = options.marginTop ?? 30, marginBottom = options.marginBottom ?? 30;
  const y = { ...(options.y ?? {}), axis: null, label: null };
  delete y.padding; delete y.paddingInner; delete y.paddingOuter; delete y.inset;
  if (ys.type === "band") Object.assign(y, { paddingInner: 1 - band / ROW, paddingOuter: 0.3 });
  else Object.assign(y, { padding: 0.5 });
  const x = { ...(options.x ?? {}) };
  if (x.ticks == null && x.interval == null) x.ticks = 4;
  const mbx = xLabelRoom(x, marginBottom);
  // each name on its own line, at the top of its row, starting on the left edge of the plot;
  // a white plate behind it (atlas.css g.rowname) so a reference rule passes behind, not through
  const narrowOptions = {
    ...options,
    width,
    height: marginTop + mbx + names.length * ROW,
    marginLeft: 12,
    marginRight: Math.min(options.marginRight ?? 20, 64),
    marginTop, marginBottom: mbx,
    x, y,
    marks: [...(options.marks ?? []), ...nameRows.marks],
  };
  const narrow = finish(narrowOptions, width);
  if (!narrow) return authoredFallback(fig);
  // drawn to the phone's width, so the site's 700 px floor for scrolling plates does not apply
  for (const el of [narrow, narrow.querySelector?.("svg")].filter(Boolean)) Object.assign(el.style, { minWidth: "0", maxWidth: "100%" });
  narrow.setAttribute?.("data-x", "other");
  narrow.setAttribute?.("data-narrow", "names-above");
  return narrow;
}

// A year label on a category axis ("2019", "2000-01", "March 2023", "Q1 FY27"): a run of those
// is a time series drawn as columns, and scrolls like one, opening at the latest end.
export const YEARISH = /^(\d{4}(-\d{2,4})?|[A-Z][a-z]+ \d{4}|Q\d\b.*|FY ?\d{2,4})$/;

// Preserve every observation and the full domains while drawing axes at phone width.
// A readable short axis needs fewer ticks, rather than a scaled 1,100px drawing.
function continuous(options, fig, xs, vw) {
  const width = Math.max(280, Math.min(vw, 760) - 2 * GUTTER);
  const x = {...(options.x ?? {})};
  delete x.interval;
  x.ticks = Array.isArray(x.ticks) && x.ticks.length <= 4 ? x.ticks : 4;
  const y = {...(options.y ?? {})};
  if (typeof y.ticks === 'number') y.ticks = Math.min(y.ticks, 5);
  const narrow = finish({...options, width, x, y,
    marginLeft: Math.min(options.marginLeft ?? 40, 48),
    marginRight: Math.min(options.marginRight ?? 20, 72),
  }, width);
  if (!narrow) return authoredFallback(fig);
  for (const el of [narrow, narrow.querySelector?.('svg')].filter(Boolean)) {
    Object.assign(el.style, {minWidth: '0', maxWidth: '100%'});
  }
  const kind = xs.type === 'time' || xs.type === 'utc' ? 'time' : 'other';
  narrow.setAttribute?.('data-x', kind);
  narrow.setAttribute?.('data-narrow', kind === 'time' ? 'time' : 'continuous');
  return narrow;
}

/* Columns over a few named categories (months, fractile classes, three kinds of bad loan): drawn
 * again at the phone's width, margins trimmed, so the whole set fits. A long run of years is
 * left at its authored width and scrolls (guide.client.js treats it as time). */
function columns(options, fig, xs, vw) {
  const dom = xs.domain ?? [];
  if (!dom.length || dom.length > 16) return fig;
  if (dom.length > 8 && dom.every((d) => d instanceof Date || YEARISH.test(String(d)))) return fig;
  const width = Math.max(280, Math.min(vw, 760) - 2 * GUTTER);
  const narrowOptions = {
    ...options, width,
    marginLeft: Math.min(options.marginLeft ?? 40, 44),
    marginRight: Math.min(options.marginRight ?? 20, 36),
  };
  const narrow = finish(narrowOptions, width);
  if (!narrow) return authoredFallback(fig);
  for (const el of [narrow, narrow.querySelector?.("svg")].filter(Boolean)) Object.assign(el.style, { minWidth: "0", maxWidth: "100%" });
  narrow.setAttribute?.("data-x", "other");
  narrow.setAttribute?.("data-narrow", "columns");
  return narrow;
}

const flat = (marks) => (marks ?? []).flat(Infinity).filter((m) => m && typeof m === "object");
const facetTitle = (domain, channel) => P.text(domain, {
  [channel]: (d) => d, text: (d) => String(d), frameAnchor: "top-left", textAnchor: "start", dy: -30,
  fontSize: 12.5, fontWeight: 600, fill: "#161A22", className: "rowname",
});

/* Faceted plates on a phone.
 *  - Panels side by side (fx over categories: wheat | rice, wind | hydro | bio): stacked one
 *    above the other at the phone's width, each panel's name above it; a categorical y inside
 *    a panel gets its names above each row, as for an unfaceted plate.
 *  - Groups down the page (fy over categories: India, China, the United States): the group's
 *    name moves from the left margin to a line above its group, the bars across the full width.
 *  Facets over years are a time series and are left to scroll (guide.client.js). */
function facets(options, fig, fxs, fys, vw) {
  const xs = fig.scale?.("x"), ys = fig.scale?.("y");
  if (fxs && fys) return fig;
  const fdom = (fxs ?? fys).domain ?? [];
  if (!fdom.length || fdom.length > 12) return fig;
  if (fdom.every((d) => d instanceof Date || (typeof d === "number" && d > 1900 && d < 2200) || YEARISH.test(String(d)))) return fig;
  if (!xs || !QUANT.has(xs.type)) return fig;
  const width = Math.max(280, Math.min(vw, 760) - 2 * GUTTER);
  const marks = flat(options.marks).map(mark => Object.assign(Object.create(Object.getPrototypeOf(mark)), mark));
  const k = fdom.length;
  const mt = Math.max(options.marginTop ?? 30, 52);
  const x = { ...(options.x ?? {}) };
  if (x.ticks == null && x.interval == null) x.ticks = 4;
  const mb = xLabelRoom(x, options.marginBottom ?? 30);
  let y = { ...(options.y ?? {}) };
  const extra = [];
  let perPanel;
  const namesInside = ys && (ys.type === "band" || ys.type === "point") && (options.y?.axis !== null);
  if (namesInside) {
    // names down a panel's left margin: above each row instead
    const band = ys.type === "band" ? Math.max(14, Math.min(44, ys.bandwidth || DOT_BAND)) : Math.max(DOT_BAND, Math.min(48, (ys.step || 0) * 0.9));
    const annotationBand=Math.max(band,64);
    const nameRows=namesAbove(ys.domain,width,annotationBand),ROW=annotationBand+nameRows.height;
    y = { ...y, axis: null, label: null }; delete y.padding; delete y.paddingInner; delete y.paddingOuter;
    if (ys.type === "band") Object.assign(y, { paddingInner: 1 - band / ROW, paddingOuter: 0.3 }); else Object.assign(y, { padding: 0.5 });
    extra.push(...nameRows.marks);
    perPanel = ys.domain.length * ROW;
  }
  let narrowOptions;
  if (fxs) {
    // side by side becomes one above the other
    if (perPanel == null) perPanel = (options.height ?? 400) - (options.marginTop ?? 30) - (options.marginBottom ?? 30);
    const gap = 72;
    for (const m of marks) if (m.fx !== undefined) { m.fy = m.fx; m.fx = undefined; }
    narrowOptions = {
      ...options, width, marginLeft: 12, marginRight: Math.min(options.marginRight ?? 20, 64), marginTop: mt, marginBottom: mb,
      height: mt + mb + k * perPanel + (k - 1) * gap,
      fx: undefined, fy: { domain: fdom, axis: null, label: null, padding: gap / (perPanel + gap) },
      x, y, marks: [...marks, ...extra, facetTitle(fdom, "fy")],
    };
  } else {
    // groups down the page: the group's name above it
    const inner = (options.height ?? 400) - (options.marginTop ?? 30) - (options.marginBottom ?? 30);
    const step = inner / k, gap = 40;
    narrowOptions = {
      ...options, width, marginLeft: 12, marginRight: Math.min(options.marginRight ?? 20, 64), marginTop: mt, marginBottom: mb,
      height: mt + mb + k * (perPanel ?? step) + k * gap,
      fy: { ...(options.fy ?? {}), domain: fdom, axis: null, label: null, padding: gap / ((perPanel ?? step) + gap) },
      x, y, marks: [...marks, ...extra, facetTitle(fdom, "fy")],
    };
  }
  const narrow = finish(narrowOptions, width);
  if (!narrow) return authoredFallback(fig);
  for (const el of [narrow, narrow.querySelector?.("svg")].filter(Boolean)) Object.assign(el.style, { minWidth: "0", maxWidth: "100%" });
  narrow.setAttribute?.("data-x", "other");
  narrow.setAttribute?.("data-narrow", fxs ? "panels-stacked" : "groups-above");
  return narrow;
}

/* ---------- settling labels on a phone ----------
 * A plate redrawn narrow keeps the label placement its client computed for the wide layout, so
 * a value label can land on a reference rule, on a row name, or past the edge. Once drawn, the
 * labels are measured with the geometry scripts/lint-charts.mjs checks (translate attributes,
 * 0.6 em a glyph), the margins are widened for anything that bleeds and the plate is drawn once
 * more, then each label still in conflict is moved to the nearest clear spot. Row names stay
 * where they are and wrap at readable size, preserving the complete visible name. */
const ADV = 0.6;
const rootSvg = (f) => (f?.tagName?.toLowerCase() === "svg" ? f : f?.querySelector?.("svg"));
const TR = /translate\(\s*([-\d.eE+]+)[\s,]+([-\d.eE+]+)\s*\)/;
function up(el, x, y) {
  let n = el.parentNode;
  while (n && n.tagName?.toLowerCase() !== "svg") { const m = (n.getAttribute?.("transform") || "").match(TR); if (m) { x += +m[1]; y += +m[2]; } n = n.parentNode; }
  return [x, y];
}
const attrUp = (el, a, d) => { for (let n = el; n && n.getAttribute; n = n.parentNode) { const v = a === 'font-size' && n.style?.fontSize ? n.style.fontSize : n.getAttribute(a); if (v) return v; } return d; };
function box(t) {
  const m = (t.getAttribute("transform") || "").match(TR);
  if (!m) return null;
  const [ax, ay] = up(t, +m[1], +m[2]);
  const fs = parseFloat(attrUp(t, "font-size", "13"));
  const spans = [...t.querySelectorAll('tspan')];
  const w = Math.max(...(spans.length ? spans : [t]).map(el => el.textContent.length * fs * ADV));
  const a = attrUp(t, "text-anchor", "middle");
  const x0 = a === "end" ? ax - w : a === "middle" ? ax - w / 2 : ax;
  let baseline = parseFloat(t.getAttribute("y") || "0.32em") * fs;
  const baselines = spans.length ? spans.map(el => { baseline = el.hasAttribute('y') ? parseFloat(el.getAttribute('y')) * fs : baseline + parseFloat(el.getAttribute('dy') || '0') * fs; return ay + baseline; }) : [ay + baseline];
  return { x0, x1: x0 + w, y0: Math.min(...baselines) - 0.82 * fs, y1: Math.max(...baselines) + 0.22 * fs, ax, ay, fs };
}
function strokes(svg) {
  const out = [];
  svg.querySelectorAll("g[aria-label] > path, g[aria-label] > line").forEach((el) => {
    const lbl = el.parentNode.getAttribute("aria-label");
    if (!["line", "rule", "link"].includes(lbl)) return;
    let pts;
    if (el.tagName.toLowerCase() === "line") pts = [up(el, +el.getAttribute("x1"), +el.getAttribute("y1")), up(el, +el.getAttribute("x2"), +el.getAttribute("y2"))];
    else {
      pts = []; let cx = 0, cy = 0; const re = /([MLHVmlhv])([^MLHVCZmlhvcz]*)/g; let q;
      while ((q = re.exec(el.getAttribute("d") || ""))) {
        const n = q[2].trim().split(/[\s,]+/).filter(Boolean).map(Number), c = q[1];
        if (c === "M" || c === "L") for (let i = 0; i + 1 < n.length; i += 2) { cx = n[i]; cy = n[i + 1]; pts.push([cx, cy]); }
        else if (c === "m" || c === "l") for (let i = 0; i + 1 < n.length; i += 2) { cx += n[i]; cy += n[i + 1]; pts.push([cx, cy]); }
        else if (c === "H") { cx = n[0]; pts.push([cx, cy]); } else if (c === "h") { cx += n[0]; pts.push([cx, cy]); }
        else if (c === "V") { cy = n[0]; pts.push([cx, cy]); } else if (c === "v") { cy += n[0]; pts.push([cx, cy]); }
      }
      pts = pts.map(([x, y]) => up(el, x, y));
    }
    if (pts.length < 2) return;
    const s = [];
    for (let i = 1; i < pts.length; i++) {
      const [x0, y0] = pts[i - 1], [x1, y1] = pts[i], n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / 2));
      for (let j = 0; j <= n; j++) s.push([x0 + ((x1 - x0) * j) / n, y0 + ((y1 - y0) * j) / n]);
    }
    out.push({ pts, s });
  });
  return out;
}
const isName = (t) => !!t.closest?.("g.rowname");
const labels = (svg) => [...svg.querySelectorAll("text")].filter((t) => {
  const g = t.closest("g[aria-label]");
  return !(g && /axis|grid/i.test(g.getAttribute("aria-label"))) && t.textContent.trim();
});
function phoneTextMarks(marks, width) {
  return flat(marks).map(mark => {
    if (typeof mark.splitLines !== 'function' || mark.lineWidth !== Infinity || String(mark.className || '').includes('rowname')) return mark;
    const copy = Object.assign(Object.create(Object.getPrototypeOf(mark)), mark);
    const fontSize = Number.isFinite(mark.fontSize) ? mark.fontSize : 13;
    const wrapWidth = Math.max(100, (width * 0.65 - 28) * 12 / fontSize + 28);
    copy.splitLines = text => String(text).split(/\r\n?|\n/).flatMap(line => narrowNameLines(line, wrapWidth));
    return copy;
  });
}
function fitLabelSides(svg, width) {
  for (const t of labels(svg)) {
    if (isName(t)) continue;
    let b = box(t); if (!b || (b.x0 >= 4 && b.x1 <= width - 4)) continue;
    const w = b.x1 - b.x0;
    const candidates = ['start', 'middle', 'end'].map(anchor => {
      const left = b.ax - (anchor === 'end' ? w : anchor === 'middle' ? w / 2 : 0);
      return {anchor, overflow: Math.max(0, 4 - left) + Math.max(0, left + w - width + 4)};
    }).sort((a,c) => a.overflow - c.overflow);
    t.setAttribute('text-anchor', candidates[0].anchor); b = box(t);
    const dx = b.x0 < 4 ? 4 - b.x0 : b.x1 > width - 4 ? width - 4 - b.x1 : 0;
    const m = (t.getAttribute('transform') || '').match(TR);
    if (m && dx) t.setAttribute('transform', `translate(${+m[1] + dx},${+m[2]})`);
  }
}
// Fit complete axis descriptions and tick labels within the canvas. Redrawing
// with wider margins preserves source marks and scale domains; no tick text is cut.
function fitAxes(options, width, wrapLabels) {
  let opts = {...options, x:{...(options.x??{})}, y:{...(options.y??{})}};
  let topExtra=0,bottomExtra=0;
  if(wrapLabels){
    for(const [axis,where] of [["x","bottom"],["y","top"]]){
      const label=opts[axis].label;
      if(typeof label!=="string" || label.length*7.8<=width-16)continue;
      const lines=narrowNameLines(label,(width-16)*12/13+28);
      opts[axis].label=lines.join("\n");
      const extra=(lines.length-1)*16;
      if(where==="top")topExtra+=extra;else bottomExtra+=extra;
    }
    opts.marginTop=(options.marginTop??30)+topExtra;
    opts.marginBottom=(options.marginBottom??30)+bottomExtra;
    if(options.height!=null)opts.height=options.height+topExtra+bottomExtra;
  }
  let fig=P.plot(opts),svg=rootSvg(fig);
  if(!svg)return fig;
  const ticks=[...svg.querySelectorAll('g[aria-label$="axis tick label"] text'),...labels(svg).filter(t=>!isName(t))].map(box).filter(Boolean);
  const left=Math.max(0,4-Math.min(4,...ticks.map(b=>b.x0)));
  const right=Math.max(0,Math.max(width-4,...ticks.map(b=>b.x1))-width+4);
  // Canvas containment reserves the full font line box; stroke collisions
  // use ink bounds (box), rather than the font's unpainted ascent/descent.
  const bounds=labels(svg).map(box).filter(Boolean).map(b=>({...b,y0:b.y0-0.18*b.fs,y1:b.y1+0.03*b.fs}));
  const h=Number(svg.getAttribute("height"));
  const up=Math.max(0,4-Math.min(4,...bounds.map(b=>b.y0)));
  const down=Math.max(0,Math.max(h-4,...bounds.map(b=>b.y1))-h+4);
  if(left||right||up||down){
    opts.marginLeft=(opts.marginLeft??40)+Math.ceil(left);
    opts.marginRight=(opts.marginRight??20)+Math.ceil(right);
    opts.marginTop=(opts.marginTop??30)+Math.ceil(up);
    opts.marginBottom=(opts.marginBottom??30)+Math.ceil(down);
    if(opts.height!=null)opts.height+=Math.ceil(up+down);
    // Wrapped row names use the full canvas rather than the data-region gutter.
    opts.marks=flat(opts.marks).map(mark=>{
      if(!String(mark.className??'').includes('rowname')||!String(mark.frameAnchor??'').includes('left'))return mark;
      const copy=Object.assign(Object.create(Object.getPrototypeOf(mark)),mark);
      copy.dx=(Number(mark.dx)||0)-Math.ceil(left);return copy;
    });
    const x=fig.scale?.('x'),y=fig.scale?.('y');
    if(x&&!opts.x.domain)opts.x.domain=x.domain;
    if(y&&!opts.y.domain)opts.y.domain=y.domain;
    fig=P.plot(opts);
  }
  return fig;
}

function authoredFallback(fig) {
  const svg=rootSvg(fig);
  if(svg){
    const width=svg.getAttribute('width');
    Object.assign(svg.style,{width:width+'px',minWidth:width+'px',maxWidth:'none'});
    svg.setAttribute('data-layout-diagnostic','Authored canvas retained: compact annotations have no clear placement');
  }
  return fig;
}
function finish(opts, width) {
  opts = {...opts, marks: phoneTextMarks(opts.marks, width)};
  let f;
  try { f = fitAxes(opts, width, true); } catch { return null; }
  let svg = rootSvg(f);
  if (!svg) return f;
  fitLabelSides(svg, width);
  // 1. room: widen the margins for labels that run past either edge, and draw once more
  let lo = 0, hi = width;
  for (const t of labels(svg)) { if (isName(t)) continue; const b = box(t); if (b) { lo = Math.min(lo, b.x0); hi = Math.max(hi, b.x1); } }
  if (lo < 0 || hi > width) {
    const o2 = { ...opts, marginLeft: (opts.marginLeft ?? 12) + Math.ceil(-lo) + 4 * (lo < 0), marginRight: (opts.marginRight ?? 20) + Math.ceil(hi - width) + 4 * (hi > width) };
    try { f = P.plot(o2); svg = rootSvg(f); } catch {}
  }
  fitLabelSides(svg, width);
  if(!settle(svg, width))return null;
  return f;
}
function settle(svg, W) {
  const H = +svg.getAttribute("height") || 1e9;
  const ts = labels(svg), ss = strokes(svg);
  const dots = [...svg.querySelectorAll("circle")].map((c) => up(c, +c.getAttribute("cx"), +c.getAttribute("cy")));
  const B = new Map(ts.map((t) => [t, box(t)]));
  const hits = (b, own) => ss.some(({ pts, s }) => {
    if (pts.length <= 4 && [pts[0], pts.at(-1)].some(([x, y]) => Math.hypot(x - own.ax, y - own.ay) < 14)) return false;
    return s.some(([x, y]) => x >= b.x0 + 2 && x <= b.x1 - 2 && y >= b.y0 + 2 && y <= b.y1 - 2);
  });
  const clash = (t, b) => {
    // Placement must keep the full font line box inside the canvas even when
    // the collision checks below only need the painted ink bounds.
    if (b.x0 < 0 || b.x1 > W || b.y0 - 0.18 * b.fs < 0 || b.y1 + 0.03 * b.fs > H) return true;
    if (!isName(t) && hits(b, b)) return true;
    const cx = (b.x0 + b.x1) / 2, cy = (b.y0 + b.y1) / 2;
    if (dots.some(([x, y]) => Math.hypot(cx - x, cy - y) < 4)) return true;
    for (const [u, c] of B) if (u !== t && c && b.x0 < c.x1 - 0.5 && b.x1 > c.x0 + 0.5 && b.y0 < c.y1 - 0.5 && b.y1 > c.y0 + 0.5) return true;
    return false;
  };
  const moves = [];
  for (const dy of [0, -5, 5, -9, 9, -13, 13]) for (const dx of [0, 6, -6, 12, -12, 20, -20, 32, -32, 48, -48]) moves.push([dx, dy]);
  moves.sort((a, b) => Math.abs(a[0]) + 1.6 * Math.abs(a[1]) - (Math.abs(b[0]) + 1.6 * Math.abs(b[1])));
  for (const t of ts) {
    if (isName(t)) continue;
    const b = B.get(t); if (!b || !clash(t, b)) continue;
    const m = (t.getAttribute("transform") || "").match(TR); if (!m) continue;
    const w = b.x1 - b.x0, extra = [[w + 18, 0], [-(w + 18), 0], [w + 18, -9], [-(w + 18), -9]];
    // nearest first; then the nearest clear spot within ~70 px, so a value never leaves its mark
    const grid = [];
    for (const dy of [0,-5,5,-9,9,-13,13,-18,18,-24,24]) for (let dx = -72; dx <= 72; dx += 4) grid.push([dx, dy]);
    grid.sort((a, c) => Math.abs(a[0]) + 3 * Math.abs(a[1]) - (Math.abs(c[0]) + 3 * Math.abs(c[1])));
    for (const [dx, dy] of [...moves.slice(1), ...extra, ...grid]) {
      const nb = { ...b, x0: b.x0 + dx, x1: b.x1 + dx, y0: b.y0 + dy, y1: b.y1 + dy, ax: b.ax + dx, ay: b.ay + dy };
      if (!clash(t, nb)) { t.setAttribute("transform", `translate(${+m[1] + dx},${+m[2] + dy})`); B.set(t, nb); break; }
    }
  }
  return ts.every(t=>{const b=B.get(t);return !b||!clash(t,b);});
}
