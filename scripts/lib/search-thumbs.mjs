// scripts/lib/search-thumbs.mjs: a chart's search thumbnail, made at build time from the chart
// kit's own phone drawing (src/kit/figure.js, the 360 px drawing every guide page carries inline).
// scripts/search-index.mjs writes one per chart under /search/th/; the search box shows it beside
// the chart's title and finding (src/search/ui.js), fetched only when the result is on screen.
//
// At about a quarter of its size no chart text is legible, so the thumbnail keeps the marks only:
// every text, hover target and data attribute goes, coordinates are rounded to whole units (a
// quarter of a pixel at thumbnail size) and line runs drop points less than a unit and a half
// apart. Strokes keep a fixed width on screen (non-scaling, at 60% of the drawing's), so a lead
// line still reads as the lead. A drawing taller than the thumbnail's shape shows its top part.
// Pure: a string in, a string (or null, for a drawing with no marks) out.

export const THUMB = { w: 96, h: 64 };

const KEEP = new Set(["rect", "line", "path", "circle", "ellipse", "polyline", "polygon", "g"]);
const ATTRS = new Set(["x", "y", "width", "height", "x1", "x2", "y1", "y2", "cx", "cy", "r", "rx", "ry", "d", "points", "transform",
  "fill", "fill-opacity", "stroke", "stroke-width", "stroke-dasharray", "stroke-opacity", "stroke-linecap", "stroke-linejoin", "opacity"]);
const round = (v) => String(Math.round(+v));
const roundAll = (s) => s.replace(/-?\d*\.?\d+(?:e-?\d+)?/gi, (m) => round(m));

// an M/L-only path, decimated: points closer than `gap` to the last one kept are dropped (the last
// point of each run is always kept, so a line still ends where the chart's does)
function thinPath(d, gap = 1.5) {
  if (/[^MLZmlz0-9.,\s-]/.test(d)) return roundAll(d);
  const out = [];
  let run = [];
  const flush = () => {
    if (!run.length) return;
    const kept = [run[0]];
    for (let i = 1; i < run.length; i++) {
      const [x, y] = run[i], [px, py] = kept.at(-1);
      if (i === run.length - 1 || Math.hypot(x - px, y - py) >= gap) kept.push(run[i]);
    }
    let s = "";
    kept.forEach(([x, y], i) => { const t = `${Math.round(x)},${Math.round(y)}`; if (i && s.endsWith("L" + t)) return; s += (i ? "L" : "M") + t; });
    out.push(s); run = [];
  };
  for (const m of d.matchAll(/([MLZmlz])([^MLZmlz]*)/g)) {
    const cmd = m[1], nums = (m[2].match(/-?\d*\.?\d+(?:e-?\d+)?/gi) ?? []).map(Number);
    if (cmd === "Z" || cmd === "z") { flush(); out.push("Z"); continue; }
    if (cmd === "m" || cmd === "l") return roundAll(d);   // relative paths: round only
    if (cmd === "M") flush();
    for (let i = 0; i + 1 < nums.length; i += 2) run.push([nums[i], nums[i + 1]]);
  }
  flush();
  return out.join("");
}

/** The thumbnail of a kit drawing (an <svg> string), or null when it has nothing to show. */
export function thumbSVG(svg, { w = THUMB.w, h = THUMB.h } = {}) {
  const root = svg.match(/^<svg\b[^>]*>/);
  if (!root) return null;
  const W = +(root[0].match(/\bwidth="([\d.]+)"/)?.[1] ?? 0), H = +(root[0].match(/\bheight="([\d.]+)"/)?.[1] ?? 0);
  if (!W || !H) return null;
  const body = svg.slice(root[0].length, svg.lastIndexOf("</svg>"))
    .replace(/<text\b[\s\S]*?<\/text>/g, "").replace(/<title\b[\s\S]*?<\/title>/g, "").replace(/<desc\b[\s\S]*?<\/desc>/g, "");
  // the thumbnail's shape: a drawing taller than it shows its top, where the lead series sits
  const vh = Math.min(H, Math.round(W * h / w * 1.15));
  let out = "", marks = 0;
  const open = [];   // for each open element, whether it is written
  for (const m of body.matchAll(/<(\/?)([a-z]+)\b([^>]*?)(\/?)>/g)) {
    const [, closing, tag, attrText, self] = m;
    if (closing) { if (open.pop()) out += `</${tag}>`; continue; }
    const attrs = {};
    for (const a of attrText.matchAll(/([a-z-]+)="([^"]*)"/g)) attrs[a[1]] = a[2];
    // hover targets and invisible boxes are not marks; nothing inside a dropped element is written
    // a mark wholly below the thumbnail's crop is not drawn either
    const below = (+(attrs.y ?? attrs.cy ?? Math.min(+(attrs.y1 ?? 0), +(attrs.y2 ?? 0))) - +(attrs.r ?? 0)) > vh;
    const keep = KEEP.has(tag) && !open.includes(false) && !/\bak-hit\b/.test(attrs.class ?? "") && attrs.fill !== "transparent" && !(tag !== "g" && tag !== "path" && below);
    if (!self) open.push(keep);
    if (!keep) continue;
    let s = `<${tag}`;
    for (const [k, v] of Object.entries(attrs)) {
      if (!ATTRS.has(k)) continue;
      if (k === "d") s += ` d="${thinPath(v)}"`;
      else if (k === "points" || k === "transform") s += ` ${k}="${roundAll(v)}"`;
      else if (k === "stroke-width") continue;
      else if (/^(x|y|x1|x2|y1|y2|cx|cy|width|height)$/.test(k)) s += ` ${k}="${round(v)}"`;
      else s += ` ${k}="${v}"`;
    }
    // a line keeps its weight on screen; a circle's white ring (the kit's halo) would swamp a
    // one-pixel dot, so a circle keeps only its fill
    const stroked = attrs.stroke && attrs.stroke !== "none";
    if (stroked && tag === "circle" && /^#f{3,6}$/i.test(attrs.stroke)) s = s.replace(/ stroke="[^"]*"/, "");
    else if (stroked && tag !== "g") s += ` stroke-width="${Math.max(0.6, +(attrs["stroke-width"] ?? 1) * 0.6).toFixed(2).replace(/\.?0+$/, "")}" vector-effect="non-scaling-stroke"`;
    if (tag !== "g") marks++;
    out += s + (self ? "/>" : ">");
  }
  if (!marks) return null;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${Math.round(W)} ${vh}" width="${w}" height="${h}" preserveAspectRatio="xMidYMin meet">${out}</svg>`;
}
