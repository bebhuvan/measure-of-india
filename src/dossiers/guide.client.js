// src/dossiers/guide.client.js: shared behaviour for every guide page.
// 1. "On this page": a contents list under the title block, built from the guide's own
//    section headings, so it can never drift from the page.
// 2. Share: each chart's download buttons become one quiet Share menu (image, SVG, data,
//    a link to that chart). The buttons themselves are moved, not recreated, so the download
//    handlers wired by plumbing.wireTools keep working.

/* ---------- on this page ---------- */
const tb = document.querySelector(".titleblock");
const heads = [...document.querySelectorAll("section > .sec-head h2, section.everycut > .em-head h2")];
if (tb && heads.length > 2) {
  const slug = (t) => t.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 48);
  const used = new Set();
  const links = heads.map((h) => {
    const sec = h.closest("section");
    let id = sec.id || slug(h.textContent);
    while (used.has(id)) id += "-2";
    used.add(id); sec.id = id;
    return `<a href="#${id}">${h.textContent.replace(/\s+/g, " ").trim()}</a>`;
  });
  const nav = document.createElement("nav");
  nav.className = "onpage";
  nav.setAttribute("aria-label", "On this page");
  nav.innerHTML = `<span>On this page</span>${links.join("")}`;
  tb.after(nav);
}

/* ---------- share ---------- */
const LABEL = { png: "Download image", svg: "Download SVG", csv: "Download data (CSV)" };
let open = null;
const close = () => { if (!open) return; open.classList.remove("open"); open.querySelector(".sh").setAttribute("aria-expanded", "false"); open = null; };
document.addEventListener("click", (e) => { if (open && !open.contains(e.target)) close(); });
document.addEventListener("keydown", (e) => { if (e.key === "Escape" && open) { const b = open.querySelector(".sh"); close(); b.focus(); } });

for (const dl of document.querySelectorAll(".plotfoot .dl, .dl")) {
  if (dl.dataset.shared) continue;
  dl.dataset.shared = "1";
  const btns = [...dl.querySelectorAll("button[data-dl]")];
  const source = dl.querySelector("a[href]");
  const fig = dl.closest("figure[id]");
  if (!btns.length && !fig) continue;
  // order: image first, then SVG, then data
  btns.sort((a, b) => ["png", "svg", "csv"].indexOf(a.dataset.dl) - ["png", "svg", "csv"].indexOf(b.dataset.dl));
  const wrap = document.createElement("div");
  wrap.className = "share";
  wrap.innerHTML = `<button type="button" class="sh" aria-haspopup="menu" aria-expanded="false">Share</button><div class="menu" role="menu"></div>`;
  const menu = wrap.querySelector(".menu");
  for (const b of btns) { b.textContent = LABEL[b.dataset.dl] || b.textContent; b.setAttribute("role", "menuitem"); menu.append(b); }
  if (fig) {
    const c = document.createElement("button");
    c.type = "button"; c.setAttribute("role", "menuitem"); c.textContent = "Copy link to this chart";
    c.addEventListener("click", async () => {
      const url = location.origin + location.pathname + "#" + fig.id;
      let ok = false; try { await navigator.clipboard.writeText(url); ok = true; } catch {}
      flash(wrap.querySelector(".sh"), ok ? "Link copied" : "Copy failed");
    });
    menu.append(c);
  }
  for (const b of menu.querySelectorAll("button")) b.addEventListener("click", () => setTimeout(close, 0));
  dl.textContent = "";
  dl.append(wrap);
  if (source) { source.textContent = "Source"; source.classList.add("srclink"); dl.append(source); }
  const sh = wrap.querySelector(".sh");
  sh.addEventListener("click", (e) => {
    e.stopPropagation();
    const was = wrap.classList.contains("open"); close();
    if (!was) {
      wrap.classList.add("open"); sh.setAttribute("aria-expanded", "true"); open = wrap;
      // keep the menu on screen: open leftward from the button unless that would run off the left edge
      menu.style.left = "auto"; menu.style.right = "0";
      const r = menu.getBoundingClientRect();
      if (r.left < 8) { menu.style.right = "auto"; menu.style.left = "0"; }
      menu.querySelector("button")?.focus();
    }
  });
}
function flash(b, msg) { const o = b.dataset.l || b.textContent; b.dataset.l = o; b.textContent = msg; b.classList.add("st"); setTimeout(() => { b.textContent = o; b.classList.remove("st"); }, 1800); }

/* ---------- display punctuation ----------
 * House style: no middle-dot strings and no spaced em dashes in what readers see. Much of the
 * text on a guide is assembled at runtime from data labels ("Headline · base 2024") and source
 * notes, so the tidy-up happens here, on rendered text only. Data, keys and the strings code
 * splits on are never touched. Runs once on load and again whenever a chart redraws. */
const SKIP = new Set(["SCRIPT", "STYLE", "TEXTAREA", "CODE"]);
const tidy = (t) => t.replace(/ · /g, ", ").replace(/ — /g, ": ");
function tidyTree(root) {
  const w = document.createTreeWalker(root, 4 /* NodeFilter.SHOW_TEXT; the constant keeps minimal DOMs happy */);
  while (w.nextNode()) {
    const n = w.currentNode;
    if (SKIP.has(n.parentElement?.tagName)) continue;
    const t = n.nodeValue;
    if (t.includes(" · ") || t.includes(" — ")) n.nodeValue = tidy(t);
  }
}
tidyTree(document.body);
const MO = typeof window !== "undefined" && window.MutationObserver;
if (MO) new MO((ms) => {
  for (const m of ms) {
    if (m.type === "characterData") { const t = m.target.nodeValue; if (t && (t.includes(" · ") || t.includes(" — ")) && !SKIP.has(m.target.parentElement?.tagName)) m.target.nodeValue = tidy(t); }
    else for (const n of m.addedNodes) n.nodeType === 1 ? tidyTree(n) : n.nodeType === 3 && !SKIP.has(n.parentElement?.tagName) && (n.nodeValue.includes(" · ") || n.nodeValue.includes(" — ")) && (n.nodeValue = tidy(n.nodeValue));
  }
}).observe(document.body, { childList: true, subtree: true, characterData: true });

/* ---------- phone plates open at today ----------
 * On phones a plate's main plot keeps its authored width and scrolls sideways (DESIGN.md §3),
 * and time runs left to right, so the latest period sits at the far right. Each scrolling plot
 * zone therefore opens at its right end: after layout, and again whenever its size changes
 * (fonts, rotation), until the reader scrolls it themselves. A quiet cue above the plot says
 * there is more to the left, and goes once the reader reaches the start. */
{
  const zones = [...document.querySelectorAll(".plotzone")];
  const touched = new WeakSet();
  let programmatic = false;
  const cueOf = new Map();
  const cue = (z) => {
    let c = cueOf.get(z);
    if (!c) {
      c = document.createElement("div");
      c.className = "pz-cue"; c.hidden = true; c.setAttribute("aria-hidden", "true");
      c.textContent = "← Earlier years";
      z.before(c); cueOf.set(z, c);
    }
    return c;
  };
  const update = (z) => {
    const max = z.scrollWidth - z.clientWidth;
    if (max <= 4) { if (cueOf.has(z)) cueOf.get(z).hidden = true; return; }
    if (!touched.has(z)) { programmatic = true; z.scrollLeft = max; programmatic = false; }
    cue(z).hidden = z.scrollLeft <= 4;
  };
  const all = () => zones.forEach(update);
  for (const z of zones) {
    z.addEventListener("scroll", () => {
      if (!programmatic) touched.add(z);
      if (cueOf.has(z)) cueOf.get(z).hidden = z.scrollLeft <= 4 || z.scrollWidth - z.clientWidth <= 4;
    }, { passive: true });
  }
  if (typeof window !== "undefined") {
    // after layout; jsdom (the qc gate) has no requestAnimationFrame, so fall back to a tick
    const raf = window.requestAnimationFrame?.bind(window) ?? ((f) => setTimeout(f, 0));
    if (document.readyState === "complete") raf(all);
    else window.addEventListener("load", () => raf(all));
    window.addEventListener("resize", all);
    if (window.ResizeObserver) { const ro = new ResizeObserver(() => all()); zones.forEach((z) => ro.observe(z)); }
  }
}
