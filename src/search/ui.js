// src/search/ui.js: the search box, wherever it sits: the home page's own box and the masthead's
// on every page (src/search/header.client.js loads this module the first time a reader reaches
// for it). One engine (src/dossiers/search-core.js) per tab, on the static index under /search/.
//
// What a reader sees, directly under the box, as they type:
//   tabs      All, Charts, Guides, Data series, Files, each with its count
//   All       search-core layout(): a state or guide the query names, then guides and charts
//             (from the core, at the first keystroke), then the series (from the shards, a moment
//             later, filling in below so nothing moves), state profiles and files. A broad
//             one-word query ("rural") shows its charts grouped by guide.
//   Charts    every chart the query finds, grouped by guide, each with its finding and a
//             thumbnail the build drew from the chart itself (scripts/lib/search-thumbs.mjs)
// Every word typed must match. Keys: up and down move through the results, Enter opens one,
// Escape closes; Tab reaches the tabs, left and right move between them.
import { createSearch, parseQuery, layout, byGuide, broadQuery } from "../dossiers/search-core.js";
// the results' styles come with this module as text, not as a stylesheet: imported as a file, the
// build linked it from every page (the home page imports this module), 1.2 KB gzip each
import css from "./search.css?inline";
if (!document.getElementById("sx-css")) document.head.insertAdjacentHTML("beforeend", `<style id="sx-css">${css}</style>`);

let S = null, loading = null;
const get = (p) => fetch(`/search/${p}`, { cache: p === "core.json" ? "no-cache" : "default", signal: AbortSignal.timeout(20000) })
  .then((r) => { if (!r.ok) throw new Error(`${p}: ${r.status}`); return r.json(); });
const qualityVersion = () => document.querySelector("[data-quality-version]")?.dataset.qualityVersion;
/** The engine, shared by every box on the page; the core (about 110 KB gzip) is fetched once. */
export const engine = () => loading ??= get("core.json").then((core) => (S = createSearch(core, get, { expectedQualityVersion: qualityVersion() }))).catch((e) => { loading = null; throw e; });

const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const reEsc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const fmtN = (n) => n.toLocaleString("en-IN");
const clip = (t, n) => (t.length > n ? t.slice(0, n - 1).replace(/[\s,;:]+\S*$/, "") + "…" : t);
const spark = (vals) => {
  const v = (vals || []).filter((x) => x != null); if (v.length < 2) return "";
  const w = 84, h = 22, lo = Math.min(...v), hi = Math.max(...v);
  const d = v.map((y, i) => `${i ? "L" : "M"}${(3 + i / (v.length - 1) * (w - 8)).toFixed(1)},${(3 + (hi - y) / ((hi - lo) || 1) * (h - 7)).toFixed(1)}`).join("");
  const ly = 3 + (hi - v.at(-1)) / ((hi - lo) || 1) * (h - 7);
  return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" aria-hidden="true"><path d="${d}" fill="none" stroke="#2E4BC4" stroke-width="1.3" stroke-linejoin="round"/><circle cx="${w - 5}" cy="${ly.toFixed(1)}" r="2.2" fill="#2E4BC4"/></svg>`;
};

const TABS = [["all", "All"], ["charts", "Charts"], ["guides", "Guides"], ["series", "Data series"], ["files", "Files"]];
// how many of each a tab lists (the All view's own counts are layout()'s)
const MAX = { charts: 60, guides: 40, series: 24, files: 12 };
let uid = 0;

/**
 * Wires a search box. `input` is the text box; `panel` an empty element under it, which this fills
 * with the tabs and the list. `sheet` is the masthead's box (src/search/header.client.js), which
 * opens as a panel or a phone sheet: this closes it on Escape, on its Close, or when the reader
 * leaves it. Returns { search, close, isOpen, setTab }.
 */
export function mount({ input, panel, sheet = null }) {
  const id = `sx${++uid}`;
  panel.innerHTML = `<div class="sx-tabs" role="tablist" aria-label="Show">${TABS.map(([k, t], i) =>
    `<button type="button" role="tab" id="${id}-t-${k}" data-tab="${k}" aria-selected="${i === 0}" aria-controls="${id}-l" tabindex="${i === 0 ? 0 : -1}">${t}<span class="n"></span></button>`).join("")}</div>` +
    `<ul class="sx-list" id="${id}-l" role="listbox" aria-label="Search results"></ul>`;
  const list = panel.querySelector(".sx-list"), tabEls = [...panel.querySelectorAll("[role=tab]")];
  input.setAttribute("role", "combobox");
  input.setAttribute("aria-controls", list.id);
  input.setAttribute("aria-autocomplete", "list");
  input.setAttribute("aria-expanded", "false");
  let tab = "all", sel = -1, seq = 0, timer = 0, pending = null, last = null;

  const invalidate = () => { ++seq; clearTimeout(timer); pending?.abort(); pending = null; };
  const isOpen = () => !panel.hidden;
  const fit = () => {
    // the panel ends at the bottom of what the reader can see (above an on-screen keyboard), so it
    // always has a clear lower edge and its own scroll
    const vh = window.visualViewport?.height ?? window.innerHeight;
    const top = panel.getBoundingClientRect().top;
    panel.style.maxHeight = `${Math.max(220, Math.floor(vh - Math.max(top, 0) - 12))}px`;
  };
  const show = () => { if (!isOpen()) { panel.hidden = false; sheet?.classList.add("open"); } input.setAttribute("aria-expanded", "true"); fit(); };
  const close = () => { invalidate(); if (isOpen()) panel.hidden = true; input.setAttribute("aria-expanded", "false"); input.removeAttribute("aria-activedescendant"); };
  const options = () => [...list.querySelectorAll("li[role=option]")];
  const mark = () => {
    const o = options();
    o.forEach((li, i) => li.setAttribute("aria-selected", i === sel));
    if (sel >= 0 && o[sel]) input.setAttribute("aria-activedescendant", o[sel].id); else input.removeAttribute("aria-activedescendant");
  };
  const setTab = (k, { focus = false } = {}) => {
    tab = k;
    tabEls.forEach((b) => { const on = b.dataset.tab === k; b.setAttribute("aria-selected", on); b.tabIndex = on ? 0 : -1; if (on && focus) b.focus(); });
    sel = 0; list.scrollTop = 0;
    if (last) draw(...last);
  };

  // ---- the views
  function draw(quick, series, words, text) {
    last = [quick, series, words, text];
    const hl = (s) => words.filter((w) => w.length > 1).reduce((o, w) => o.replace(new RegExp(`\\b(${reEsc(w)}\\w*)`, "ig"), "<mark>$1</mark>"), esc(s));
    const opt = (href, main, meta, right = "", mid = "", cls = "") =>
      `<li role="option" class="ro${cls}" data-href="${esc(href)}"><a href="${esc(href)}" tabindex="-1"><span class="rn">${hl(main)}<span class="rm">${esc(meta)}</span></span><span class="rs">${mid}</span><span class="rv">${right}</span></a></li>`;
    const chart = (p, showGuide = true) =>
      `<li role="option" class="ro rc" data-href="${esc(p.href)}"><a href="${esc(p.href)}" tabindex="-1"><span class="th">${p.thumb ? `<img src="/search/${esc(p.thumb)}" alt="" width="96" height="64" loading="lazy" decoding="async">` : ""}</span>` +
      `<span class="rn">${hl(p.title)}${p.finding ? `<span class="rf">${hl(clip(p.finding, 150))}</span>` : ""}<span class="rm">${showGuide ? `${esc(p.guide)}, chart` : "Chart"}</span></span></a></li>`;
    const guide = (g) => opt(g.href, g.title, g.note ? clip(g.note, 140) : "", "<small>Guide</small>");
    const state = (x) => opt(x.href, x.title, x.note, "<small>Profile</small>");
    const file = (f) => opt(f.href, f.title, f.note, "<small>File</small>");
    const row = (r) => opt(r.explorerHref || r.href, r.label,
      r.quality?.canInterpret === false ? `Under review. Archived label: ${clip(r.originalLabel, 100)}` :
        [r.group && !r.label.startsWith(r.group) ? r.group : null, `${r.guide ?? "Data file"}: ${clip(r.file, 70)}`].filter(Boolean).join(". "),
      r.quality?.canInterpret === false ? "<small>Under review</small>" : `${esc(r.latest)}<small>${esc(r.period)}${r.expectedSchedule ? ` · ${esc(r.expectedSchedule.label)} · ${esc(r.expectedSchedule.asOf)}` : ""}</small>`,
      r.expectedSchedule ? "" : spark(r.recent));
    const head = (t, n = "") => `<li class="sec" role="presentation"><span>${t}</span>${n ? `<span class="c">${n}</span>` : ""}</li>`;
    const more = (k, t) => `<li role="option" class="ro more" data-tab="${k}"><span>${t}</span></li>`;
    const waitRow = (t) => `<li class="wait" role="status">${t}</li>`;
    const seriesOk = series && !series.error;
    const n = {
      charts: quick.n.plates, guides: quick.n.guides + quick.n.states,
      series: seriesOk ? series.total : null, files: seriesOk ? series.nFiles : quick.n.files,
    };
    const counts = { all: "", charts: fmtN(n.charts), guides: fmtN(n.guides), series: n.series == null ? "…" : `${series.approx ? "~" : ""}${fmtN(n.series)}`, files: fmtN(n.files) };
    tabEls.forEach((b) => { b.querySelector(".n").textContent = counts[b.dataset.tab]; b.classList.toggle("zero", counts[b.dataset.tab] === "0"); });
    const seriesState = () => series === null ? waitRow("Searching the series…")
      : series.error ? waitRow("Series search could not load. Check your connection and type again to retry. If the site has updated, reload this page.") : "";
    const grouped = (plates, per, groups = Infinity) => byGuide(plates).slice(0, groups).map((grp) =>
      head(`<a href="${esc(grp.href)}" tabindex="-1">${esc(grp.title)}</a>`, "") + grp.items.slice(0, per).map((p) => chart(p, false)).join("")).join("");
    let html = "";
    if (tab === "all") {
      const sections = layout(quick, seriesOk ? series : null);
      const at = (k) => sections.find((x) => x.kind === k).items;
      const lead = [...at("state").map(state), ...at("guide").map((x) => x.kind === "Chart" ? chart(x) : guide(x))];
      if (lead.length) html += head("Best match") + lead.join("");
      const gs = at("top").filter((x) => x.kind === "Guide"), cs = at("top").filter((x) => x.kind === "Chart");
      if (gs.length) html += head("Guides") + gs.map(guide).join("");
      // grouped by guide only when some chart names the word whole (the others follow the series)
      const broad = cs.length > 0 && broadQuery(text, quick.plates);
      // charts that only begin with a word or find it in their guide come after the series (layout())
      const ms = broad ? [] : at("more");
      const shownCharts = (broad ? byGuide(quick.plates).slice(0, 3).reduce((a, g) => a + Math.min(2, g.items.length), 0) : cs.length + ms.length) + at("guide").filter((x) => x.kind === "Chart").length;
      if (cs.length) {
        // a broad word finds charts across many guides: show where they are, two from each of the
        // first three guides, before any one title
        html += head(broad ? `Charts, by guide` : "Charts", n.charts > shownCharts ? `${fmtN(n.charts)} in all` : "");
        const led = new Set(at("guide").map((x) => x.href));
        html += broad ? grouped(quick.plates.filter((p) => !led.has(p.href)), 2, 3) : cs.map((p) => chart(p)).join("");
        if (n.charts > shownCharts) html += more("charts", `All ${fmtN(n.charts)} charts`);
      }
      const moreCharts = () => ms.length ? head(cs.length ? "More charts" : "Charts", !cs.length && n.charts > shownCharts ? `${fmtN(n.charts)} in all` : "") + ms.map((p) => chart(p)).join("") +
        (!cs.length && n.charts > shownCharts ? more("charts", `All ${fmtN(n.charts)} charts`) : "") : "";
      if (seriesOk && series.rows.length) {
        html += head("Data series", `${series.approx ? "about " : ""}${fmtN(series.total)} ${series.total === 1 ? "match" : "matches"}`) + at("series").map(row).join("");
        if (series.total > at("series").length) html += more("series", `More series`);
      } else html += seriesState();
      html += moreCharts();
      if (at("states").length) html += head("State profiles") + at("states").map(state).join("");
      if (at("files").length) { html += head("Files") + at("files").map(file).join(""); if (n.files > at("files").length) html += more("files", `All ${fmtN(n.files)} files`); }
      const nothing = seriesOk && !series.rows.length && !lead.length && !gs.length && !cs.length && !ms.length && !quick.files.length && !quick.states.length && !series.files.length;
      if (nothing) html = `<li class="none">Nothing matches “${esc(text)}”. Try fewer words, or a broader one, such as prices, output or a state's name.</li>`;
    } else if (tab === "charts") {
      const ps = quick.plates.slice(0, MAX.charts);
      html = ps.length ? (new Set(ps.map((p) => p.g)).size > 1 ? grouped(ps, MAX.charts) : ps.map((p) => chart(p)).join("")) +
        (n.charts > ps.length ? `<li class="none">The ${MAX.charts} closest of ${fmtN(n.charts)}. Add a word to narrow them.</li>` : "")
        : `<li class="none">No chart's title or finding matches “${esc(text)}”.</li>`;
    } else if (tab === "guides") {
      const gs = quick.guides, st = quick.states;
      html = (gs.length ? head("Guides") + gs.map(guide).join("") : "") + (st.length ? head("State profiles") + st.map(state).join("") : "");
      if (!html) html = `<li class="none">No guide is about “${esc(text)}”.</li>`;
    } else if (tab === "series") {
      if (!seriesOk) html = seriesState();
      else if (series.rows.length) html = series.rows.map(row).join("") + (series.total > series.rows.length ? `<li class="none">The ${series.rows.length} closest of ${series.approx ? "about " : ""}${fmtN(series.total)}. Add a word, a place or a year to narrow them.</li>` : "");
      else html = `<li class="none">No series matches “${esc(text)}”.</li>`;
    } else if (tab === "files") {
      const fs = seriesOk ? series.files : quick.files;
      html = fs.length ? fs.map(file).join("") + (series === null ? seriesState() : "") : series === null ? seriesState() : `<li class="none">No file matches “${esc(text)}”.</li>`;
    }
    if (seriesOk && series.suggestion) html += `<li role="option" class="ro more" data-suggestion="${esc(series.suggestion)}"><span>Search for “${esc(series.suggestion)}”</span></li>`;
    list.innerHTML = html;
    options().forEach((li, i) => { li.id = `${id}-o${i}`; });
    const o = options();
    sel = o.length ? Math.min(Math.max(sel, 0), o.length - 1) : -1;
    mark();
    show();
  }

  function activate(li) {
    if (!li) return;
    if (li.dataset.suggestion) { input.value = li.dataset.suggestion; search(); }
    else if (li.dataset.tab) setTab(li.dataset.tab);
    else location.href = li.dataset.href;
  }

  async function search() {
    invalidate();
    const mine = seq, text = input.value;
    const words = parseQuery(text).map((w) => w.w);
    if (!words.length) { last = null; close(); return; }
    if (!S) {
      list.innerHTML = `<li class="wait" role="status">Loading search…</li>`; show();
      try { await engine(); } catch {
        if (mine !== seq) return;
        list.innerHTML = `<li class="wait" role="status">Search could not load. Check your connection and type again to retry.</li>`;
        return;
      }
    }
    if (mine !== seq) return;
    // guides and charts answer at once from the core; the series a moment later, below them
    const quick = S.quick(text, { limit: MAX.guides, plateLimit: MAX.charts });
    sel = 0;
    draw(quick, null, words, text);
    timer = setTimeout(async () => {
      pending = new AbortController();
      let series;
      try {
        series = await S.series(text, { limit: MAX.series, fileLimit: MAX.files, signal: pending.signal, onCandidates: (m) => {
          // a fully matched row proves its guide is relevant before the row file arrives
          if (mine === seq && !quick.guides.length && m.guides.length) { quick.guides = m.guides; quick.n.guides = m.guides.length; draw(quick, null, words, text); }
        } });
        // a query that finds nothing may be a slip of the keyboard: offer the one-edit spelling
        if (!series.rows.length) series.suggestion = await S.suggest(text).catch(() => null);
      } catch (e) {
        if (e.name === "AbortError") return;
        series = { rows: [], total: 0, error: true, files: [] };
      }
      if (mine === seq) draw(quick, series, words, text);
    }, 120);
  }

  // ---- events
  input.addEventListener("input", search);
  input.addEventListener("focus", () => { if (input.value.trim()) search(); else engine().catch(() => {}); });
  input.addEventListener("keydown", (e) => {
    if (e.key === "Escape") { if (isOpen()) { e.preventDefault(); close(); } return; }
    const o = options();
    if (!isOpen() || !o.length) return;
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault(); sel = (sel + (e.key === "ArrowDown" ? 1 : -1) + o.length) % o.length;
      mark(); o[sel].scrollIntoView({ block: "nearest" });
    } else if (e.key === "Enter" && sel >= 0) { e.preventDefault(); activate(o[sel]); }
  });
  // a pointer on the panel never takes the focus from the box, so the reader can keep typing;
  // a tab or a result does what it says on click
  panel.addEventListener("mousedown", (e) => { if (e.button === 0) e.preventDefault(); });
  panel.addEventListener("click", (e) => {
    const t = e.target.closest("[role=tab]");
    if (t) { setTab(t.dataset.tab); return; }
    const li = e.target.closest("li[role=option]");
    if (!li) return;
    // a plain click opens the result; with a modifier the browser opens the link as it would
    if (li.dataset.href && (e.metaKey || e.ctrlKey || e.shiftKey || e.button === 1)) return;
    e.preventDefault(); activate(li);
  });
  panel.querySelector(".sx-tabs").addEventListener("keydown", (e) => {
    const i = tabEls.findIndex((b) => b === document.activeElement);
    if (i < 0) return;
    if (e.key === "ArrowRight" || e.key === "ArrowLeft") { e.preventDefault(); setTab(tabEls[(i + (e.key === "ArrowRight" ? 1 : -1) + tabEls.length) % tabEls.length].dataset.tab, { focus: true }); }
    else if (e.key === "ArrowDown") { e.preventDefault(); input.focus(); }
    // back to the box, closed (focusing the box first, as its focus reopens a query's results)
    else if (e.key === "Escape") { e.preventDefault(); input.focus(); close(); }
  });
  window.visualViewport?.addEventListener("resize", () => { if (isOpen()) fit(); });
  if (sheet) {
    // its Close and its hint (shown while the box is empty) are made here, not carried by every page
    input.insertAdjacentHTML("afterend", `<button type="button" class="sx-close">Close</button>`);
    panel.insertAdjacentHTML("afterend", `<p class="sx-hint">Every guide, chart, series and file. Try rural, repo rate or inflation in Kerala.</p>`);
    // the results may empty (the box cleared) while the reader is still in the box: the sheet or
    // panel stays open until they leave it, press Escape or Close (which also clears the box)
    const shut = () => { sheet.classList.remove("open"); close(); };
    sheet.addEventListener("click", (e) => { if (e.target.closest(".sx-close")) { shut(); input.value = ""; } });
    sheet.addEventListener("keydown", (e) => { if (e.key === "Escape") { shut(); document.activeElement?.blur(); } });
    sheet.addEventListener("focusout", (e) => { if (!sheet.contains(e.relatedTarget)) setTimeout(() => { if (!sheet.contains(document.activeElement)) shut(); }, 0); });
  }
  return { search, close, isOpen, setTab };
}
