// src/kit/enhance.js: the only chart code a reader's browser runs. Charts are complete without
// it (src/kit/figure.js draws them at build time); this adds a hover readout on lines, a tip on
// marks that carry data-tip, and the CSV / SVG / PNG downloads. In the built site the wide and mid
// drawings, the hover series and the CSV tables wait in <page>/kit.json, fetched once, when a
// wide drawing is shown or a reader first points at a chart or asks for its data.

const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;");
const tnum = (d) => { const [y, m = 1, dd = 1] = String(d).split("-").map(Number); return y + (m - 1) / 12 + (dd - 1) / 365; };
const tlabel = (d, f) => { const [y, m] = String(d).split("-"); if (f === "fy") return `${y}-${String((+y + 1) % 100).padStart(2, "0")}`; if (f === "year" || !m) return y;if (f === "quarter") return `${MON[+m - 1]}–${MON[(+m + 1) % 12]} ${y}`; if (f === "day") return `${+String(d).split("-")[2]} ${MON[+m - 1]} ${y}`; return `${MON[+m - 1]} ${y}`; };
const group = (i) => { const l = i.slice(-3), r = i.slice(0, -3); return (r ? r.replace(/\B(?=(\d{2})+(?!\d))/g, ",") + "," : "") + l; };
const num = (v, [pre, suf, dp]) => { if (v == null) return "–"; const [i, f] = Math.abs(v).toFixed(dp).split("."); return (v < 0 && +Math.abs(v).toFixed(dp) ? "−" : "") + pre + group(i) + (f ? "." + f : "") + suf; };

let tip;
function show(html, ev) {
  tip.innerHTML = html; tip.style.opacity = 1;
  const r = tip.getBoundingClientRect();
  let x = ev.clientX + 14; if (x + r.width > innerWidth - 8) x = ev.clientX - r.width - 14;
  tip.style.transform = `translate(${Math.max(8, x)}px,${Math.max(8, ev.clientY - r.height - 12)}px)`;
}
const hide = () => { tip.style.opacity = 0; };

function lineHover(fig, svg, series) {
  if (svg.akWired) return; svg.akWired = true;
  const m = JSON.parse(svg.dataset.ak), hit = svg.querySelector(":scope > .ak-hit");
  if (m.s) series = m.s; // a panel of a composed figure carries its own series (kit panels())
  if (!hit) return;
  const [px0, px1, t0, t1] = m.x, [py0, py1, v0, v1] = m.y;
  const X = (t) => px0 + (t - t0) / ((t1 - t0) || 1) * (px1 - px0), Y = m.l ? (v) => py0 + (Math.log10(v) - Math.log10(v0)) / ((Math.log10(v1) - Math.log10(v0)) || 1) * (py1 - py0) : (v) => py0 + (v - v0) / ((v1 - v0) || 1) * (py1 - py0);
  const pts = series.map((s) => s[2].map((p) => ({ d: p[0], t: tnum(p[0]), v: p[1] })));
  const g = document.createElementNS("http://www.w3.org/2000/svg", "g"); g.style.pointerEvents = "none"; svg.append(g);
  const top = +hit.getAttribute("y"), bot = top + +hit.getAttribute("height");
  hit.addEventListener("pointermove", (e) => {
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(svg.getScreenCTM().inverse());
    const tt = t0 + (p.x - px0) / (px1 - px0) * (t1 - t0);
    let best = null;
    for (const P of pts) for (const q of P) if (q.v != null && (!best || Math.abs(q.t - tt) < Math.abs(best.t - tt))) best = q;
    if (!best) return;
    const x = X(best.t);
    let html = `<b>${esc(tlabel(best.d, m.f))}</b>`, dots = `<line x1="${x}" x2="${x}" y1="${top}" y2="${bot}" stroke="#9CA0A7"/>`;
    series.forEach((s, i) => {
      const q = pts[i].find((z) => z.d === best.d); if (!q || q.v == null) return;
      html += `<span><i style="background:${s[1]}"></i>${esc(s[0])} <b>${esc(num(q.v, m.u))}</b></span>`;
      dots += `<circle cx="${x}" cy="${Y(q.v)}" r="4" fill="${s[1]}" stroke="#fff" stroke-width="2"/>`;
    });
    g.innerHTML = dots; show(html, e);
  });
  hit.addEventListener("pointerleave", () => { g.innerHTML = ""; hide(); });
}

function visibleSVG(fig) {
  for (const d of fig.querySelectorAll(".akf-plot > div")) if (d.offsetParent !== null) return d.querySelector("svg");
  return fig.querySelector("svg");
}
function save(name, blob) {
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name;
  document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
async function download(fig, kind) {
  const name = fig.dataset.file || "india-atlas_chart";
  if (kind === "csv") {
    let d = JSON.parse(fig.querySelector(".akf-data")?.textContent ?? "null") ?? (fig.dataset.csvk ? (await kit())[fig.dataset.csvk] : null);
    const S = d ? null : await seriesOf(fig);
    if (!d && S) { // a line chart: one row per date, one column per series, blanks for gaps
      const dates = [...new Set(S.flatMap((s) => s[2].map((p) => p[0])))].sort();
      const at = S.map((s) => new Map(s[2].map((p) => [p[0], p[1]])));
      d = { cols: ["Date", ...S.map((s) => s[0])], rows: dates.map((t) => [t, ...at.map((m) => m.get(t) ?? null)]) };
    }
    if (!d) return;
    const cell = (v) => v == null ? "" : /[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v);
    const box = fig.closest("figure") ?? fig, src = box.querySelector(".akf-src, .plotfoot .src")?.textContent?.replace(/\s+/g, " ").trim();
    save(name + ".csv", new Blob([[d.cols, ...d.rows].map((r) => r.map(cell).join(",")).join("\n") + (src ? `\n\n${cell(src)}\n` : "\n")], { type: "text/csv" }));
  } else {
    // the card's code, faces and mark load only when a reader asks for an image (src/kit/card.js)
    const { standalone } = await import("./card.js");
    const { text, w, h } = await standalone(fig, { visibleSVG, kit });
    if (kind === "svg") return save(name + ".svg", new Blob([text], { type: "image/svg+xml" }));
    const img = new Image(), k = 2;
    img.onload = () => { const c = document.createElement("canvas"); c.width = w * k; c.height = h * k; const x = c.getContext("2d"); x.scale(k, k); x.drawImage(img, 0, 0); c.toBlob((b) => save(name + ".png", b)); };
    img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(text);
  }
}

export function enhance(root = document) {
  tip = document.querySelector(".ak-tip") ?? Object.assign(document.createElement("div"), { className: "ak-tip" });
  if (!tip.isConnected) document.body.append(tip);
  for (const fig of root.querySelectorAll(".akf")) {
    const series = fig.dataset.aks ? JSON.parse(fig.dataset.aks) : null;
    if (series) for (const svg of fig.querySelectorAll("svg[data-ak]")) lineHover(fig, svg, series);
    else if (fig.dataset.aksk) for (const svg of fig.querySelectorAll("svg[data-ak]")) // series fetched on first approach
      svg.addEventListener("pointerenter", async () => { const S = await seriesOf(fig); if (S) lineHover(fig, svg, S); }, { once: true });
    // a guide plate keeps its own download buttons around a bare figure; one figure per plate
    const box = fig.closest("figure") ?? fig;
    // bound once per plate (learn port: a plate may hold two figures, the explorer redraws); the figure is found at click time
    if (!box.akBound) { box.akBound = true; box.addEventListener("click", (e) => { const b = e.target.closest("[data-akdl], [data-dl]"); const f = box.matches(".akf") ? box : box.querySelector(".akf"); if (b && f) download(f, b.dataset.akdl ?? b.dataset.dl); }); }
  }
  tips(root);
  fill();
}
function tips(root) {
  for (const el of root.querySelectorAll(".akf [data-tip]")) {
    if (el.akTip) continue; el.akTip = true;
    el.addEventListener("pointermove", (e) => show(esc(el.dataset.tip), e));
    el.addEventListener("pointerleave", hide);
  }
}

// The built site ships each figure's wide and mid drawings in <page>/kit.json (src/kit/figure.js);
// fetch it once, only when a placeholder is actually shown, and drop each drawing into its box.
let kitP = null;
const kitURL = () => { const p = location.pathname; return p.endsWith("/") ? p + "kit.json" : p.replace(/(\.html)?$/, ".kit.json"); };
const kit = () => (kitP ??= fetch(kitURL()).then((r) => (r.ok ? r.json() : {})).catch(() => ({})));
async function seriesOf(fig) {
  if (fig.dataset.aks) return JSON.parse(fig.dataset.aks);
  return fig.dataset.aksk ? (await kit())[fig.dataset.aksk] ?? null : null;
}
async function fill() {
  const need = [...document.querySelectorAll(".akf-plot > [data-k]:empty")].filter((el) => getComputedStyle(el).display !== "none");
  if (!need.length) return;
  const K = await kit();
  for (const el of need) {
    const svg = K[el.dataset.k]; if (!svg || el.firstChild) continue;
    el.innerHTML = svg; el.style.aspectRatio = "";
    const fig = el.closest(".akf"), series = fig ? await seriesOf(fig) : null;
    if (series) for (const s of el.querySelectorAll("svg[data-ak]")) lineHover(fig, s, series);
    tips(el);
  }
}
if (typeof window !== "undefined") { let t; window.addEventListener("resize", () => { clearTimeout(t); t = setTimeout(fill, 150); }); }

if (typeof document !== "undefined") {
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => enhance());
  else enhance();
}
