// src/dossiers/home.client.js: the home page search, on the static index scripts/search-index.mjs
// writes under /search/ and the engine in src/dossiers/search-core.js. The small core index
// loads on first focus and answers for guides, charts and files at once; series come from the
// shards the query's words need, a moment later. Every word typed must match.
import { createSearch, parseQuery, layout } from "./search-core.js";

const q = document.getElementById("q");
const res = document.getElementById("results");
if (q && res) {
  let S = null, loading = null, sel = -1, seq = 0, timer = 0, pending = null;
  const get = (p) => fetch(`/search/${p}`, { cache: p === 'core.json' ? 'no-cache' : 'default', signal: AbortSignal.timeout(20000) }).then((r) => { if (!r.ok) throw new Error(`${p}: ${r.status}`); return r.json(); });
  const load = () => loading ??= get("core.json").then((core) => (S = createSearch(core, get, {expectedQualityVersion:document.getElementById('find')?.dataset.qualityVersion}))).catch(e => { loading = null; throw e; });
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
  const invalidate = () => { ++seq; clearTimeout(timer); pending?.abort(); pending = null; };
  const close = () => { invalidate(); res.hidden = true; q.setAttribute("aria-expanded", "false"); q.removeAttribute("aria-activedescendant"); };
  const options = () => [...res.querySelectorAll("li[role=option]")];
  const mark = () => options().forEach((li, i) => li.setAttribute("aria-selected", i === sel));

  function render(quick, series, words) {
    const hl = (s) => words.filter((w) => w.length > 1).reduce((o, w) => o.replace(new RegExp(`\\b(${reEsc(w)}\\w*)`, "ig"), "<mark>$1</mark>"), esc(s));
    const opt = (href, main, meta, right = "", mid = "") =>
      `<li role="option" data-href="${esc(href)}"><div class="rn">${hl(main)}<span class="rm">${esc(meta)}</span></div><div class="rs">${mid}</div><div class="rv">${right}</div></li>`;
    const head = (t) => `<li class="sec" role="presentation">${t}</li>`;
    // the order is search-core.js layout(): a state the query names, a guide or chart every word
    // names, the series, then guides and charts, other state profiles and whole files
    let html = "";
    const clip = (t, n) => (t.length > n ? t.slice(0, n - 1).replace(/[\s,;:]+\S*$/, "") + "…" : t);
    const sections = layout(quick, series && !series.error ? series : null);
    const at = (k) => sections.find((x) => x.kind === k).items;
    const states = quick.states ?? [], top = at("top");
    if (at("state").length) html += head("State profile") + at("state").map((x) => opt(x.href, x.title, x.note, "<small>Profile</small>")).join("");
    if (at("guide").length) html += head(at("guide")[0].kind === "Chart" ? "Chart" : "Guide") + at("guide").map((x) => opt(x.href, x.title, x.note, `<small>${x.kind}</small>`)).join("");
    if (series === null) html += `<li class="wait" role="status">Searching the series…</li>`;
    else if (series.error) html += `<li class="wait" role="status">Series search could not load. Check your connection and type again to retry. If the site has updated, reload this page.</li>`;
    else if (series.rows.length) {
      html += head(`Series <span>${series.approx ? "about " : ""}${fmtN(series.total)} ${series.total === 1 ? "match" : "matches"}</span>`);
      html += at("series").map((r) => opt(r.explorerHref || r.href, r.label,
        r.quality?.canInterpret===false?`Under review. Archived label: ${clip(r.originalLabel,100)}`:
          [r.group && !r.label.startsWith(r.group) ? r.group : null, `${r.guide ?? "Data file"}: ${clip(r.file, 70)}`].filter(Boolean).join(". "),
        r.quality?.canInterpret===false?'<small>Under review</small>':`${esc(r.latest)}<small>${esc(r.period)}${r.expectedSchedule?` · ${esc(r.expectedSchedule.label)} · ${esc(r.expectedSchedule.asOf)}`:''}</small>`, r.expectedSchedule?'':spark(r.recent))).join("");
    }
    if (top.length) html += head("Guides and charts") + top.map((x) => opt(x.href, x.title, x.note, `<small>${x.kind}</small>`)).join("");
    if (at("states").length) html += head("State profiles") + at("states").map((x) => opt(x.href, x.title, x.note, "<small>Profile</small>")).join("");
    if (at("files").length) html += head("Files") + at("files").map((f) => opt(f.href, f.title, f.note, "<small>File</small>")).join("");
    if (!html || (series && !series.error && !series.rows.length && !top.length && !at("guide").length && !quick.files.length && !states.length))
      html = `<li class="none">Nothing matches “${esc(q.value)}”. Try fewer words, or a broader one, such as prices, output or a state's name.</li>`;
    if (series?.suggestion) html += `<li role="option" data-suggestion="${esc(series.suggestion)}">Search for “${esc(series.suggestion)}”</li>`;
    res.innerHTML = html;
    options().forEach((li, i) => {
      li.id = `opt${i}`;
      li.addEventListener("mousedown", (e) => { e.preventDefault(); activate(li); });
    });
    sel = options().length ? Math.min(Math.max(sel, 0), options().length - 1) : -1;
    mark();
    if (sel >= 0) q.setAttribute('aria-activedescendant', 'opt' + sel);
    else q.removeAttribute('aria-activedescendant');
    res.hidden = false; q.setAttribute("aria-expanded", "true");
  }

  function activate(option) {
    if (option.dataset.suggestion) { q.value=option.dataset.suggestion; search(); }
    else location.href=option.dataset.href;
  }

  async function search() {
    invalidate();
    const mine = seq;
    const text = q.value;
    const words = parseQuery(text).map((w) => w.w);
    if (!words.length) { close(); return; }
    if (!S) {
      res.innerHTML = '<li class="wait" role="status">Loading search…</li>';
      res.hidden = false; q.setAttribute('aria-expanded', 'true');
      try { await load(); } catch {
        if (mine !== seq) return;
        res.innerHTML = '<li class="wait" role="status">Search could not load. Check your connection and type again to retry.</li>';
        return;
      }
    }
    if (mine !== seq) return;
    const quick = S.quick(text);
    sel = 0;
    render(quick, null, words);
    clearTimeout(timer);
    timer = setTimeout(async () => {
      pending = new AbortController();
      let series;
      try { series = await S.series(text, { signal: pending.signal, onCandidates: matches => {
        // A fully matched catalogue row proves the guide is relevant before its row file
        // arrives. Keep useful guide navigation available during the remaining transfer.
        if(mine===seq&&!quick.guides.length&&matches.guides.length) {
          quick.guides=matches.guides; render(quick,null,words);
        }
      } });
        // a query that finds nothing may be a slip of the keyboard: offer the one-edit spelling
        if (!series.rows.length) series.suggestion = await S.suggest(text).catch(() => null);
      } catch (e) {
        if (e.name === 'AbortError') return;
        series = { rows: [], total: 0, error: true };
      }
      if (mine === seq) render(quick, series, words);
    }, 120);
  }
  q.addEventListener("focus", () => { if (q.value.trim()) search(); else load().catch(() => {}); });
  // The search box is the home page's main door: fetch the small core (about 110 KB) once the page
  // is idle, so the first query answers at once. Not on a metered or 2G connection, where it waits
  // for the reader to reach for the box.
  const net = window.navigator?.connection;
  if (!(net?.saveData || /(^|-)2g$/.test(net?.effectiveType ?? ""))) {
    const warm = () => load().catch(() => {});
    if (window.requestIdleCallback) window.addEventListener("load", () => window.requestIdleCallback(warm, { timeout: 4000 }), { once: true });
    else window.addEventListener("load", () => setTimeout(warm, 1500), { once: true });
  }
  q.addEventListener("input", search);
  q.addEventListener("keydown", (e) => {
    if (e.key === "Escape") { close(); return; }
    const opts = options();
    if (res.hidden || !opts.length) return;
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault(); sel = (sel + (e.key === "ArrowDown" ? 1 : -1) + opts.length) % opts.length;
      mark(); q.setAttribute("aria-activedescendant", "opt" + sel); opts[sel].scrollIntoView({ block: "nearest" });
    }
    if (e.key === "Enter" && sel >= 0) { e.preventDefault(); activate(opts[sel]); }
  });
  q.addEventListener("blur", () => { invalidate(); setTimeout(() => { if (document.activeElement !== q) close(); }, 150); });
}
// "/" jumps to search from anywhere on the page
document.addEventListener("keydown", (e) => {
  if (e.key !== "/" || /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName)) return;
  const box = document.getElementById("q");
  if (box) { e.preventDefault(); box.focus(); }
});
