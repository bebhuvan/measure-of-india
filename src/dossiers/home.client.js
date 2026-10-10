// src/dossiers/home.client.js: the home page search, on the static index scripts/search-index.mjs
// writes under /search/ and the engine in src/dossiers/search-core.js. The small core index
// loads on first focus and answers for guides, charts and files at once; series come from the
// shards the query's words need, a moment later. Every word typed must match.
import { createSearch, parseQuery } from "./search-core.js";

const q = document.getElementById("q");
const res = document.getElementById("results");
if (q && res) {
  let S = null, loading = null, sel = -1, seq = 0, timer = 0;
  const get = (p) => fetch(`/search/${p}`).then((r) => { if (!r.ok) throw new Error(`${p}: ${r.status}`); return r.json(); });
  const load = () => loading ??= get("core.json").then((core) => (S = createSearch(core, get)));
  const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  const reEsc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const fmtN = (n) => n.toLocaleString("en-IN");
  const spark = (vals) => {
    const v = (vals || []).filter((x) => x != null); if (v.length < 2) return "";
    const w = 84, h = 22, lo = Math.min(...v), hi = Math.max(...v);
    const d = v.map((y, i) => `${i ? "L" : "M"}${(3 + i / (v.length - 1) * (w - 8)).toFixed(1)},${(3 + (hi - y) / ((hi - lo) || 1) * (h - 7)).toFixed(1)}`).join("");
    const ly = 3 + (hi - v.at(-1)) / ((hi - lo) || 1) * (h - 7);
    return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" aria-hidden="true"><path d="${d}" fill="none" stroke="#2E4BD8" stroke-width="1.3" stroke-linejoin="round"/><circle cx="${w - 5}" cy="${ly.toFixed(1)}" r="2.2" fill="#2E4BD8"/></svg>`;
  };
  const close = () => { res.hidden = true; q.setAttribute("aria-expanded", "false"); q.removeAttribute("aria-activedescendant"); };
  const options = () => [...res.querySelectorAll("li[role=option]")];
  const mark = () => options().forEach((li, i) => li.setAttribute("aria-selected", i === sel));

  function render(quick, series, words) {
    const hl = (s) => words.filter((w) => w.length > 1).reduce((o, w) => o.replace(new RegExp(`\\b(${reEsc(w)}\\w*)`, "ig"), "<mark>$1</mark>"), esc(s));
    const opt = (href, main, meta, right = "", mid = "") =>
      `<li role="option" data-href="${esc(href)}"><div class="rn">${hl(main)}<span class="rm">${esc(meta)}</span></div><div class="rs">${mid}</div><div class="rv">${right}</div></li>`;
    const head = (t) => `<li class="sec" role="presentation">${t}</li>`;
    // series first (what the box promises), then guides and charts, then whole files
    let html = "";
    const clip = (t, n) => (t.length > n ? t.slice(0, n - 1).replace(/[\s,;:]+\S*$/, "") + "…" : t);
    const top = [...quick.guides.slice(0, 1).map((g) => ({ ...g, kind: "Guide" })), ...quick.plates.slice(0, 3).map((p) => ({ ...p, kind: "Chart" }))].slice(0, 3);
    if (series === null) html += `<li class="wait" role="presentation">Searching the series…</li>`;
    else if (series.rows.length) {
      html += head(`Series <span>${series.approx ? "about " : ""}${fmtN(series.total)} ${series.total === 1 ? "match" : "matches"}</span>`);
      html += series.rows.slice(0, 6).map((r) => opt(r.href, r.label,
        [r.group && !r.label.startsWith(r.group) ? r.group : null, `${r.guide ?? "Data file"}: ${clip(r.file, 70)}`].filter(Boolean).join(". "),
        `${esc(r.latest)}<small>${esc(r.period)}</small>`, spark(r.recent))).join("");
    }
    if (top.length) html += head("Guides and charts") + top.map((x) => opt(x.href, x.title, x.note, `<small>${x.kind}</small>`)).join("");
    if (quick.files.length) html += head("Files") + quick.files.slice(0, 3).map((f) => opt(f.href, f.title, f.note, "<small>File</small>")).join("");
    if (!html || (series && !series.rows.length && !top.length && !quick.files.length))
      html = `<li class="none">Nothing matches “${esc(q.value)}”. Try fewer words, or a broader one, such as prices, output or a state's name.</li>`;
    res.innerHTML = html;
    options().forEach((li, i) => {
      li.id = `opt${i}`;
      li.addEventListener("mousedown", (e) => { e.preventDefault(); location.href = li.dataset.href; });
    });
    sel = options().length ? Math.min(Math.max(sel, 0), options().length - 1) : -1;
    mark();
    res.hidden = false; q.setAttribute("aria-expanded", "true");
  }

  async function search() {
    const text = q.value;
    const words = parseQuery(text).map((w) => w.w);
    if (!words.length || !S) { close(); return; }
    const mine = ++seq;
    const quick = S.quick(text);
    sel = 0;
    render(quick, null, words);
    clearTimeout(timer);
    timer = setTimeout(async () => {
      let series;
      try { series = await S.series(text); } catch { series = { rows: [], total: 0 }; }
      if (mine === seq) render(quick, series, words);
    }, 120);
  }
  q.addEventListener("focus", () => load().then(search), { once: true });
  q.addEventListener("input", () => (S ? search() : load().then(search)));
  q.addEventListener("keydown", (e) => {
    if (e.key === "Escape") { close(); return; }
    const opts = options();
    if (res.hidden || !opts.length) return;
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault(); sel = (sel + (e.key === "ArrowDown" ? 1 : -1) + opts.length) % opts.length;
      mark(); q.setAttribute("aria-activedescendant", "opt" + sel); opts[sel].scrollIntoView({ block: "nearest" });
    }
    if (e.key === "Enter" && sel >= 0) location.href = opts[sel].dataset.href;
  });
  q.addEventListener("blur", () => setTimeout(close, 150));
}
// "/" jumps to search from anywhere on the page
document.addEventListener("keydown", (e) => {
  if (e.key !== "/" || /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName)) return;
  const box = document.getElementById("q");
  if (box) { e.preventDefault(); box.focus(); }
});
