// src/kit/enhance.js: the only chart code a reader's browser runs. Charts are complete without
// it (src/kit/figure.js draws them at build time); this adds a hover readout on lines, a tip on
// marks that carry data-tip, and the CSV / SVG / PNG downloads. Under 3 KB; no data fetched.

const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;");
const tnum = (d) => { const [y, m = 1, dd = 1] = String(d).split("-").map(Number); return y + (m - 1) / 12 + (dd - 1) / 365; };
const tlabel = (d, f) => { const [y, m] = String(d).split("-"); if (f === "year" || !m) return y; if (f === "quarter") return `${MON[+m - 1]}–${MON[(+m + 1) % 12]} ${y}`; return `${MON[+m - 1]} ${y}`; };
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
  const m = JSON.parse(svg.dataset.ak), hit = svg.querySelector(".ak-hit");
  if (!hit) return;
  const [px0, px1, t0, t1] = m.x, [py0, py1, v0, v1] = m.y;
  const X = (t) => px0 + (t - t0) / ((t1 - t0) || 1) * (px1 - px0), Y = (v) => py0 + (v - v0) / ((v1 - v0) || 1) * (py1 - py0);
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
// A standalone drawing: the title above, the source below, the chart face named inline.
function standalone(fig) {
  const svg = visibleSVG(fig).cloneNode(true), w = +svg.getAttribute("width"), h = +svg.getAttribute("height");
  const box = fig.closest("figure") ?? fig;
  const title = (box.querySelector(".akf-title, .plate-head h3")?.textContent ?? "").trim();
  const src = (box.querySelector(".akf-src, .plotfoot .src")?.textContent ?? "").replace(/\s+/g, " ").trim();
  const NS = "http://www.w3.org/2000/svg", out = document.createElementNS(NS, "svg"), H = h + 64;
  out.setAttribute("xmlns", NS); out.setAttribute("width", w); out.setAttribute("height", H); out.setAttribute("viewBox", `0 0 ${w} ${H}`);
  out.setAttribute("font-family", "'Libre Franklin', 'Helvetica Neue', Arial, sans-serif");
  out.innerHTML = `<rect width="${w}" height="${H}" fill="#fff"/><text x="0" y="18" font-size="15" font-weight="600" fill="#15171A">${esc(title)}</text>` +
    `<g transform="translate(0,34)">${svg.innerHTML}</g><text x="0" y="${H - 6}" font-size="11" fill="#6B7078">${esc(src)}</text>`;
  out.querySelectorAll(".ak-hit").forEach((n) => n.remove());
  return { text: new XMLSerializer().serializeToString(out), w, h: H };
}
function download(fig, kind) {
  const name = fig.dataset.file || "india-atlas_chart";
  if (kind === "csv") {
    const d = JSON.parse(fig.querySelector(".akf-data")?.textContent ?? "null"); if (!d) return;
    const cell = (v) => v == null ? "" : /[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v);
    const box = fig.closest("figure") ?? fig, src = box.querySelector(".akf-src, .plotfoot .src")?.textContent?.replace(/\s+/g, " ").trim();
    save(name + ".csv", new Blob([[d.cols, ...d.rows].map((r) => r.map(cell).join(",")).join("\n") + (src ? `\n\n${cell(src)}\n` : "\n")], { type: "text/csv" }));
  } else {
    const { text, w, h } = standalone(fig);
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
    // a guide plate keeps its own download buttons around a bare figure; one figure per plate
    const box = fig.closest("figure") ?? fig;
    box.addEventListener("click", (e) => { const b = e.target.closest("[data-akdl], [data-dl]"); if (b) download(fig, b.dataset.akdl ?? b.dataset.dl); });
  }
  for (const el of root.querySelectorAll(".akf [data-tip]")) {
    el.addEventListener("pointermove", (e) => show(esc(el.dataset.tip), e));
    el.addEventListener("pointerleave", hide);
  }
}

if (typeof document !== "undefined") {
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => enhance());
  else enhance();
}
