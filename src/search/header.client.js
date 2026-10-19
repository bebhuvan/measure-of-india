// src/search/header.client.js: the masthead's search box, on every page (src/layouts/Base.astro).
// A real input; the first time a reader reaches for it (a tap, a click, a key, "/") it loads the
// search module (src/search/ui.js, with the engine and its styles) and opens: on a phone a sheet
// over the whole screen, wider up a panel with a clear edge, results directly under the box. Until
// then this is all a page carries for search, a few hundred bytes.
// The service worker and the install line (src/pwa/app.js) ride in the same file: one script on
// every page rather than two.
import "../pwa/app.js";
const root = document.getElementById("sx");
const input = document.getElementById("sxq");
if (root && input) {
  let ui = null, wanted = null;
  // the extra parentheses keep Vite from wrapping this import in its preload helper (it wraps only
  // an import whose argument starts with a quote), about 650 bytes gzip on every page; the module
  // has no stylesheet to preload (its styles come as text) and loads its one shared chunk itself.
  // It closes the box too (Escape, Close, leaving it): this file carries only what opens it.
  const ready = () => wanted ??= import(("./ui.js")).then((m) => {
    ui = m.mount({ input, panel: root.querySelector(".sx-panel"), sheet: root });
    m.engine().catch(() => {});
    // a reader who left the box before the module arrived finds it closed
    if (!root.contains(document.activeElement)) root.classList.remove("open");
    return ui;
  }).catch((e) => { wanted = null; root.classList.remove("open"); throw e; });
  // the sheet or panel (atlas.css) opens with the box, before any result, so the reader sees where
  // they type; what they type before the module arrives is searched once it has
  input.addEventListener("focus", () => { root.classList.add("open"); if (!ui) ready().then((u) => { if (input.value.trim()) u.search(); }).catch(() => {}); });
  // "/" puts the cursor in search from anywhere; on the home page its own box takes it (home.client.js)
  document.addEventListener("keydown", (e) => {
    if (e.key !== "/" || e.metaKey || e.ctrlKey || e.altKey || e.target.closest?.("input,textarea,select,[contenteditable]") || document.getElementById("q")) return;
    e.preventDefault(); input.focus();
  });
}
