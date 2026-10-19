// src/dossiers/home.client.js: the home page's search box, the site's main door. The box and its
// results are src/search/ui.js, the same as the masthead's on every page; this file only adds what
// is the home page's own: the search module and core fetched when the page goes idle, /?q= and
// /#find, and "/". The module (about 13 KB gzip) is not part of the page's own script, so the page
// is drawn and ready before it loads; a reader who types first loads it at the first keystroke.
const q = document.getElementById("q");
const res = document.getElementById("results");
if (q && res) {
  // when the box sits low on the screen (always, on a phone above its keyboard) it comes up near the
  // top as the reader types, so the results under it get the screen rather than a strip (registered
  // before mount(), so the panel measures itself after the move)
  q.addEventListener("input", () => {
    const vh = window.visualViewport?.height ?? window.innerHeight, r = q.getBoundingClientRect();
    if (r.top < 0 || vh - r.bottom < Math.min(560, vh * 0.6)) window.scrollTo({ top: window.scrollY + r.top - 16, behavior: "instant" });
  });
  let loading = null, mounted = false;
  // parenthesised so Vite adds no preload helper (src/search/header.client.js says why)
  const ready = () => loading ??= import(("../search/ui.js")).then((m) => {
    const ui = m.mount({ input: q, panel: res });
    mounted = true;
    q.addEventListener("blur", () => setTimeout(() => { if (document.activeElement !== q && !res.contains(document.activeElement)) ui.close(); }, 150));
    return { m, ui };
  }).catch((e) => { loading = null; throw e; });
  // typed before the module arrived: the search runs once it has (mount() takes every later
  // keystroke); a module that failed to load is asked for again at the next one
  q.addEventListener("input", () => { if (!mounted) ready().then(({ ui }) => ui.search()).catch(() => {}); });
  q.addEventListener("focus", () => { if (!mounted) ready().catch(() => {}); });
  // The module and the core (about 110 KB gzip) are fetched once the page is idle, so the first query
  // answers at once. Not on a metered or 2G connection, where they wait for the reader to reach for the box.
  const net = window.navigator?.connection;
  if (!(net?.saveData || /(^|-)2g$/.test(net?.effectiveType ?? ""))) {
    const warm = () => ready().then(({ m }) => m.engine()).catch(() => {});
    if (window.requestIdleCallback) window.addEventListener("load", () => window.requestIdleCallback(warm, { timeout: 4000 }), { once: true });
    else window.addEventListener("load", () => setTimeout(warm, 1500), { once: true });
  }
  // /?q=words runs that search (the WebSite SearchAction in src/seo/graph.js, shared links, and the
  // masthead box without script); /#find (the app's Search shortcut) puts the cursor in the box
  const asked = new URLSearchParams(location.search).get("q")?.trim();
  if (asked) { q.value = asked.slice(0, 200); q.focus(); ready().then(({ ui }) => ui.search()).catch(() => {}); }
  else if (location.hash === "#find") q.focus({ preventScroll: true });
  // "/" jumps to this box from anywhere on the page (the masthead's box takes it on other pages)
  document.addEventListener("keydown", (e) => {
    if (e.key !== "/" || e.metaKey || e.ctrlKey || e.altKey || /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName) || document.activeElement?.isContentEditable) return;
    e.preventDefault(); q.focus();
  });
}
