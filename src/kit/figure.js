// src/kit/figure.js: a chart as a finished figure, drawn at build time.
//
// figure() takes the finding (title), a subtitle, the source line and a draw function, and
// returns HTML: one <figure> holding three drawings of the same chart (WIDTHS), for a desktop plate,
// a tablet and a phone. CSS container queries show the one that fits (kit.css), so text is
// always drawn at its true size and nothing is scaled into illegibility. The page needs no
// chart code to read a chart; src/kit/enhance.js only adds hover and downloads.
//
//   figure({ id, title, sub, source, notes, draw: (width) => K.line({ ...spec, width }),
//            data: { cols: ['Month', 'Per cent'], rows: [['2025-08', 2.07], ...] } })
//
// `data` is what the CSV download carries; a line chart's series are used when it is absent.

// The guides' plate is 1184 px wide on a desktop (the margin column plus the text column), about
// 600-1000 on a tablet or narrow window, and 320-400 on a phone. kit.css switches at 1000 and 600.
export const WIDTHS = { wide: 1184, mid: 720, phone: 360 };

const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);

// The three drawings carry the same series; keep them once, on the figure.
const AK = /data-ak='([^']*)'/;
function hoist(svgs) {
  let series = null;
  const out = svgs.map((svg) => svg.replace(AK, (_, raw) => {
    const o = JSON.parse(raw.replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&amp;/g, "&"));
    series ??= o.s; delete o.s;
    return `data-ak='${attrJSON(o)}'`;
  }));
  return { out, series };
}
// In the built site only the phone drawing is in the page. The wide and mid drawings are keyed
// by a hash of their content; after the build, the kit integration in astro.config.mjs gathers
// the drawings each page's placeholders name into one file beside it (<page>/kit.json), which
// enhance.js fetches when a figure is wide enough to need it. A phone downloads only what it
// shows; each placeholder holds its drawing's exact box, so nothing moves when it arrives.
// In dev, and in scripts run outside Astro, all three drawings are inline.
const SPLIT = !!import.meta.env?.PROD;
const ALT = (globalThis.__akAlt ??= new Map());
const box = (svg) => { const m = svg.slice(0, 300).match(/width="([\d.]+)" height="([\d.]+)"/); return m ? `${m[1]} / ${m[2]}` : "2 / 1"; };
function hash(str) { // two FNV-1a passes, 64 bits as hex
  let a = 0x811c9dc5, b = 0x01000193 ^ str.length;
  for (let i = 0; i < str.length; i++) { const c = str.charCodeAt(i); a = Math.imul(a ^ c, 16777619); b = Math.imul(b ^ c, 2246822519); }
  return (a >>> 0).toString(16).padStart(8, "0") + (b >>> 0).toString(16).padStart(8, "0");
}
function drawing(kind, svg) {
  if (!SPLIT || kind === "phone") return `<div class="akf-${kind}" aria-hidden="true">${svg}</div>`;
  const k = hash(svg); ALT.set(k, svg);
  return `<div class="akf-${kind}" aria-hidden="true" data-k="${k}" style="aspect-ratio:${box(svg)}"></div>`;
}
const attrJSON = (o) => JSON.stringify(o).replace(/&/g, "&amp;").replace(/'/g, "&#39;").replace(/</g, "&lt;");
// The hover series and the CSV table are only needed when a reader points at a chart or asks for
// its data: in the built site they travel in kit.json too (by hash), not in the page.
function dataAttrs(series, csv) {
  if (!SPLIT) return { attrs: series ? ` data-aks='${attrJSON(series)}'` : "", tag: csv ? `<script type="application/json" class="akf-data">${JSON.stringify(csv).replace(/</g, "\\u003c")}</script>` : "" };
  let attrs = "";
  if (series) { const k = hash(JSON.stringify(series)); ALT.set(k, series); attrs += ` data-aksk="${k}"`; }
  if (csv) { const k = hash(JSON.stringify(csv)); ALT.set(k, csv); attrs += ` data-csvk="${k}"`; }
  return { attrs, tag: "" };
}

// bare: the drawings and their data only, for a page that already sets the title, source line and
// download buttons around the chart (the guides' plates); enhance.js wires those buttons.
export function figure({ id, title = "", sub = "", source = "", notes = "", draw, data = null, file = null, widths = WIDTHS, className = "", bare = false, label = "" }) {
  const drawn = ["wide", "mid", "phone"].map((k) => draw(widths[k]));
  const { out, series } = hoist(drawn);
  // a line chart's CSV is rebuilt from its hover series in the browser (enhance.js), so the
  // series ship once; other forms carry their table explicitly
  const csv = data;
  const name = file ?? `india-atlas_${slug(id || title)}`;
  const aria = esc(label || title + (sub ? ". " + sub : ""));
  const plot = `<div class="akf-plot" role="img" aria-label="${aria}">` +
    out.map((svg, i) => drawing(["wide", "mid", "phone"][i], svg)).join("") + `</div>`;
  const { attrs, tag: dataTag } = dataAttrs(series, csv);
  if (bare) return `<div class="akf akf-bare"${attrs} data-file="${esc(name)}">${plot}${dataTag}</div>`;
  return `<figure class="akf${className ? " " + className : ""}"${id ? ` id="${esc(id)}"` : ""}${attrs} data-file="${esc(name)}">` +
    (title ? `<figcaption class="akf-head"><h3 class="akf-title">${esc(title)}</h3>${sub ? `<p class="akf-sub">${esc(sub)}</p>` : ""}</figcaption>` : "") +
    plot +
    `<div class="akf-foot">${source ? `<p class="akf-src">${source}</p>` : ""}${notes ? `<p class="akf-note">${notes}</p>` : ""}` +
    `<p class="akf-dl"><button type="button" data-akdl="csv">CSV</button><button type="button" data-akdl="svg">SVG</button><button type="button" data-akdl="png">PNG</button></p></div>` +
    dataTag + `</figure>`;
}
