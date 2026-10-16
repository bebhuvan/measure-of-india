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
const attrJSON = (o) => JSON.stringify(o).replace(/&/g, "&amp;").replace(/'/g, "&#39;").replace(/</g, "&lt;");

// bare: the drawings and their data only, for a page that already sets the title, source line and
// download buttons around the chart (the guides' plates); enhance.js wires those buttons.
export function figure({ id, title = "", sub = "", source = "", notes = "", draw, data = null, file = null, widths = WIDTHS, className = "", bare = false, label = "" }) {
  const drawn = ["wide", "mid", "phone"].map((k) => draw(widths[k]));
  const { out, series } = hoist(drawn);
  const csv = data ?? (series ? fromSeries(series) : null);
  const name = file ?? `india-atlas_${slug(id || title)}`;
  const aria = esc(label || title + (sub ? ". " + sub : ""));
  const plot = `<div class="akf-plot" role="img" aria-label="${aria}">` +
    out.map((svg, i) => `<div class="akf-${["wide", "mid", "phone"][i]}" aria-hidden="true">${svg}</div>`).join("") + `</div>`;
  const dataTag = csv ? `<script type="application/json" class="akf-data">${JSON.stringify(csv).replace(/</g, "\\u003c")}</script>` : "";
  if (bare) return `<div class="akf akf-bare"${series ? ` data-aks='${attrJSON(series)}'` : ""} data-file="${esc(name)}">${plot}${dataTag}</div>`;
  return `<figure class="akf${className ? " " + className : ""}"${id ? ` id="${esc(id)}"` : ""}${series ? ` data-aks='${attrJSON(series)}'` : ""} data-file="${esc(name)}">` +
    (title ? `<figcaption class="akf-head"><h3 class="akf-title">${esc(title)}</h3>${sub ? `<p class="akf-sub">${esc(sub)}</p>` : ""}</figcaption>` : "") +
    plot +
    `<div class="akf-foot">${source ? `<p class="akf-src">${source}</p>` : ""}${notes ? `<p class="akf-note">${notes}</p>` : ""}` +
    `<p class="akf-dl"><button type="button" data-akdl="csv">CSV</button><button type="button" data-akdl="svg">SVG</button><button type="button" data-akdl="png">PNG</button></p></div>` +
    dataTag + `</figure>`;
}

// A line chart's series as one table: a row per date, a column per series, nulls left blank.
function fromSeries(series) {
  const dates = [...new Set(series.flatMap((s) => s[2].map((p) => p[0])))].sort();
  const at = series.map((s) => new Map(s[2].map((p) => [p[0], p[1]])));
  return { cols: ["Date", ...series.map((s) => s[0])], rows: dates.map((d) => [d, ...at.map((m) => m.get(d) ?? null)]) };
}
