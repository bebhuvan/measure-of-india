// src/dossiers/everycut.client.js: sorting, filtering and folding for the every-cut tables
// (src/components/EveryCutTable.astro), and streaming in the rows a page does not render.
//
// A page renders its first rows in HTML; the rest arrive in its pack (data-pack, a gzip file of one
// <tr> per line, src/dossiers/everycut-html.js). Once the page is idle the pack is fetched,
// decompressed as it arrives and appended in short batches, so the main thread is never held for
// long, and then sorting, filtering and the browser's find-in-page cover every row. On a metered
// or 2G connection it waits until the reader reaches for the table (find, sort, filter, show all,
// or scrolling to its end). A link to one row (#s1a2b3c4, the anchor everycut.js rowAnchor gives
// it; site search links there) keeps that row shown however the table is folded, marks it and
// scrolls to it, waiting for the stream if the row is in the pack.
const yieldToPage = () => (globalThis.scheduler?.yield ? scheduler.yield() : new Promise((r) => setTimeout(r, 0)));
const idle = (fn) => (window.requestIdleCallback ? window.requestIdleCallback(fn, { timeout: 2500 }) : setTimeout(fn, 300));
const net = window.navigator?.connection;
const frugal = !!(net?.saveData || /(^|-)2g$/.test(net?.effectiveType ?? ""));

for (const root of document.querySelectorAll(".ec")) {
  const tbody = root.querySelector("tbody");
  const rows = [...tbody.rows];
  const q = root.querySelector(".ec-q input");
  const fFacet = root.querySelector('[data-f="facet"]');
  const fFile = root.querySelector('[data-f="file"]');
  const count = root.querySelector(".ec-n");
  const more = root.querySelector(".ec-more");
  const none = root.querySelector(".ec-none");
  const fold = +root.dataset.fold || 25;
  const total = +root.dataset.total || rows.length;
  let open = false;
  let target = null;
  let sortKey = null, dir = 1;
  // what a row is searched and filtered by: its own text, read once from the cells
  const prime = (tr) => { tr._facet = tr.cells[1].textContent.trim(); tr._s = (tr.cells[0].textContent + " " + tr._facet).toLowerCase(); };
  rows.forEach(prime);

  const filterState = () => {
    const needle = (q?.value || "").trim().toLowerCase();
    return { terms: needle ? needle.split(/\s+/) : [], fc: fFacet?.value || "", fl: fFile?.value || "" };
  };
  const matches = (tr, f) => (!f.fc || tr._facet === f.fc) && (!f.fl || tr.dataset.file === f.fl) && f.terms.every((t) => tr._s.includes(t));
  const loading = () => rows.length < total;
  const apply = () => {
    const f = filterState(), filtered = !!(f.terms.length || f.fc || f.fl);
    let shown = 0, match = 0;
    for (const tr of tbody.rows) {
      const ok = matches(tr, f);
      if (ok) match++;
      const vis = ok && (open || filtered || match <= fold || tr === target);
      tr.hidden = !vis;
      if (vis) shown++;
    }
    const n = (x) => x.toLocaleString("en-IN");
    if (count) count.textContent = (filtered ? `${n(match)} of ${n(total)} series` : `${n(total)} series`) + (loading() ? `, ${n(total - rows.length)} still loading` : "");
    if (more) more.hidden = open || filtered || total <= fold;
    if (none) none.hidden = match > 0 || loading();
  };

  // sort: text columns A to Z first, numbers largest first; blanks always last
  const val = (tr, k) => (k === "label" ? tr.cells[0].firstChild.textContent : k === "facet" ? tr._facet : tr.dataset[k]);
  const sortRows = () => {
    if (!sortKey) return;
    const k = sortKey, numeric = k === "v" || k === "c";
    const sorted = rows.slice().sort((a, b) => {
      const x = val(a, k), y = val(b, k);
      if (numeric) {
        if (x === "" && y === "") return a.dataset.o - b.dataset.o;
        if (x === "") return 1;
        if (y === "") return -1;
        return dir * (x - y) || a.dataset.o - b.dataset.o;
      }
      return dir * x.localeCompare(y, "en-IN") || a.dataset.o - b.dataset.o;
    });
    tbody.append(...sorted);
  };
  for (const btn of root.querySelectorAll("th button[data-sort]")) {
    btn.addEventListener("click", () => {
      start();
      const k = btn.dataset.sort, numeric = k === "v" || k === "c";
      if (sortKey === k) dir = -dir; else { sortKey = k; dir = numeric ? -1 : 1; }
      for (const th of root.querySelectorAll("th")) th.removeAttribute("aria-sort");
      btn.closest("th").setAttribute("aria-sort", dir > 0 ? "ascending" : "descending");
      sortRows();
      apply();
    });
  }
  q?.addEventListener("input", apply);
  q?.addEventListener("focus", () => start(), { once: true });
  fFacet?.addEventListener("change", apply);
  fFile?.addEventListener("change", apply);
  more?.addEventListener("click", () => { open = true; start(); apply(); });
  const goTo = () => {
    const id = decodeURIComponent(window.location.hash.slice(1));
    const tr = id ? document.getElementById(id) : null;
    if (!tr || tr.parentNode !== tbody) { if (id && /^s[0-9a-z]{7}$/.test(id) && loading()) start(); return false; }
    target = tr;
    for (const r of rows) r.classList.toggle("ec-hit", r === tr);
    apply();
    tr.scrollIntoView?.({ block: "center" });
    return true;
  };
  window.addEventListener("hashchange", goTo);

  // ----- the pack
  let started = null;
  function start() {
    if (started || !root.dataset.pack || !loading()) return started;
    started = stream().then(() => { root.dataset.complete = ""; root.dispatchEvent(new CustomEvent("ec:complete")); },
      (e) => { root.dataset.failed = ""; if (count) count.textContent = `${rows.length.toLocaleString("en-IN")} of ${total.toLocaleString("en-IN")} series shown; the rest could not load. Reload, or download the CSV.`; console.error(e); });
    (document.__atlasEveryCut ??= []).push(started);
    return started;
  }
  async function stream() {
    if (typeof DecompressionStream === "undefined") throw new Error("This browser cannot unpack the rest of the table");
    const res = await fetch(root.dataset.pack);
    if (!res.ok) throw new Error(`${root.dataset.pack}: ${res.status}`);
    const reader = res.body.pipeThrough(new DecompressionStream("gzip")).pipeThrough(new TextDecoderStream()).getReader();
    const tpl = document.createElement("template");
    let buf = "", waiting = !!window.location.hash;
    const add = async (lines) => {
      // append in batches of about 8 ms of work, yielding to the page between them
      for (let i = 0; i < lines.length; ) {
        const t0 = performance.now();
        const f = filterState(), filtered = !!(f.terms.length || f.fc || f.fl);
        while (i < lines.length && performance.now() - t0 < 8) {
          const j = Math.min(lines.length, i + 50);
          tpl.innerHTML = lines.slice(i, j).join("");
          const fresh = [...tpl.content.children];
          for (const tr of fresh) { prime(tr); tr.hidden = !(matches(tr, f) && (open || filtered || rows.length < fold)); rows.push(tr); }
          tbody.append(...fresh);
          i = j;
        }
        apply();
        if (waiting && goTo()) waiting = false;
        await yieldToPage();
      }
    };
    for (;;) {
      const { done, value } = await reader.read();
      if (value) buf += value;
      const cut = done ? buf.length : buf.lastIndexOf("\n");
      if (cut > 0) { const lines = buf.slice(0, cut).split("\n").filter(Boolean); buf = buf.slice(cut + 1); await add(lines); }
      if (done) break;
    }
    if (rows.length !== total) throw new Error(`every-cut: ${rows.length} rows of ${total} after the pack`);
    sortRows();
    apply();
  }
  // scrolling to the end of what is shown asks for the rest
  const end = root.querySelector(".ec-none") ?? root;
  if (window.IntersectionObserver && root.dataset.pack) new window.IntersectionObserver((es, ob) => { if (es.some((e) => e.isIntersecting)) { start(); ob.disconnect(); } }, { rootMargin: "800px" }).observe(end);
  if (root.dataset.pack && !frugal) window.addEventListener("load", () => idle(start), { once: true });

  apply();
  goTo();
}
