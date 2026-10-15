// src/dossiers/guide.client.js: shared behaviour for every guide page.
// 1. "On this page": a contents list under the title block, built from the guide's own
//    section headings, so it can never drift from the page.
// 2. Actions: each chart's download buttons become one quiet row in its footer (image, SVG,
//    data, a link to that chart, the source). The buttons themselves are moved, not
//    recreated, so the download handlers wired by plumbing.wireTools keep working.

/* ---------- on this page ---------- */
// numbered as the sections are (a guide is a sequence: broad first, granular last)
const tb = document.querySelector(".titleblock");
const heads = [...document.querySelectorAll("section > .sec-head h2, section.everycut > .em-head h2")];
if (tb && heads.length > 2) {
  const slug = (t) => t.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 48);
  const esc = (t) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;");
  const used = new Set();
  const links = heads.map((h) => {
    const sec = h.closest("section");
    let id = sec.id || slug(h.textContent);
    while (used.has(id)) id += "-2";
    used.add(id); sec.id = id;
    const no = h.parentElement.querySelector(".no")?.textContent.trim() ?? "";
    return `<a href="#${id}"><i>${esc(no)}</i><b>${esc(h.textContent.replace(/\s+/g, " ").trim())}</b></a>`;
  });
  const nav = document.createElement("nav");
  nav.className = "onpage";
  nav.setAttribute("aria-label", "On this page");
  nav.innerHTML = `<span>On this page</span>${links.join("")}`;
  tb.after(nav);
}

/* ---------- readouts fit the margin ----------
 * A plate's readout sits in the 220px margin (DESIGN §0.1). Most are a figure ("4.8%"); some
 * are a figure with words ("₹158.1 lakh crore") or a name ("Personal care, incl. gold"). They
 * are set by length, once the client has filled them: a figure large, a long figure smaller,
 * words as a short serif line. Runs again whenever a client fills one late. */
const fitReadout = (v) => {
  const t = (v.textContent || "").replace(/\s+/g, " ").trim();
  v.classList.remove("rv-m", "rv-w");
  if (!t || t === "–") return;
  const digits = (t.match(/[0-9]/g) || []).length;
  if (digits === 0 || t.length > 13) v.classList.add("rv-w");
  else if (t.length > 8) v.classList.add("rv-m");
};
const readouts = () => document.querySelectorAll("figure[id^='cb-'] .plate-val .v, .titleblock .num .v");
readouts().forEach(fitReadout);
if (typeof window !== "undefined" && window.MutationObserver) {
  const mo = new window.MutationObserver((ms) => { for (const m of ms) { const v = (m.target.nodeType === 1 ? m.target : m.target.parentElement)?.closest?.(".plate-val .v, .titleblock .num .v"); if (v) fitReadout(v); } });
  readouts().forEach((v) => mo.observe(v, { childList: true, characterData: true, subtree: true }));
}

/* ---------- actions (DESIGN §0.5) ----------
 * Each chart's footer carries its actions in the open: Download image, SVG, data; Copy link;
 * Source. The download buttons are moved, not recreated, so the handlers plumbing.wireTools
 * attached keep working. A status ("Link copied") is announced in a polite live region and
 * fades; it never replaces a label or moves the row. */
const LABEL = { png: "Image", svg: "SVG", csv: "Data" };
const TITLE = { png: "Download the chart as an image (PNG), with its title and source", svg: "Download the chart as SVG, for print and editing", csv: "Download the chart's data as CSV" };
for (const dl of document.querySelectorAll(".plotfoot .dl, .dl")) {
  if (dl.dataset.shared) continue;
  dl.dataset.shared = "1";
  const btns = [...dl.querySelectorAll("button[data-dl]")];
  const links = [...dl.querySelectorAll("a[href]")];
  const source = links.find((a) => /^https?:/.test(a.getAttribute("href")));
  const fig = dl.closest("figure[id]");
  if (!btns.length && !fig) continue;
  btns.sort((a, b) => ["png", "svg", "csv"].indexOf(a.dataset.dl) - ["png", "svg", "csv"].indexOf(b.dataset.dl));
  const row = document.createElement("div");
  row.className = "acts";
  row.setAttribute("role", "group");
  row.setAttribute("aria-label", "Download or share this chart");
  if (btns.length) {
    const lab = document.createElement("span");
    lab.className = "lab"; lab.textContent = "Download";
    row.append(lab);
    for (const b of btns) { b.textContent = LABEL[b.dataset.dl] || b.textContent; b.type = "button"; b.title = TITLE[b.dataset.dl] || ""; row.append(b); }
  }
  const st = document.createElement("span");
  st.className = "st"; st.setAttribute("role", "status"); st.setAttribute("aria-live", "polite");
  if (fig) {
    if (btns.length) { const g = document.createElement("span"); g.className = "gap"; row.append(g); }
    const c = document.createElement("button");
    c.type = "button"; c.textContent = "Copy link";
    c.title = "Copy a link that opens the page at this chart";
    c.addEventListener("click", async () => {
      const url = location.origin + location.pathname + "#" + fig.id;
      let ok = false; try { await navigator.clipboard.writeText(url); ok = true; } catch {}
      say(st, ok ? "Link copied" : "Copy failed: the link is " + url);
    });
    row.append(c);
  }
  for (const a of links) {
    if (a === source) { a.textContent = "Source"; a.title = "The publisher's page for this data"; }
    else if (/^\/data\//.test(a.getAttribute("href")) && /^data$/i.test(a.textContent.trim())) { a.textContent = "Whole file"; a.title = "Download the whole data file this chart is drawn from (CSV)"; }
    row.append(a);
  }
  row.append(st);
  dl.textContent = "";
  dl.append(row);
}
function say(el, msg) { el.textContent = msg; el.classList.add("on"); clearTimeout(el._t); el._t = setTimeout(() => { el.classList.remove("on"); setTimeout(() => { el.textContent = ""; }, 250); }, 2400); }

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
 * and time runs left to right, so the latest period sits at the far right. A scrolling plot zone
 * whose chart has TIME on its x axis therefore opens at its right end: after layout, and again
 * whenever its size changes (fonts, rotation), until the reader scrolls it themselves. A quiet
 * cue above the plot says there is more to the left, and goes once the reader reaches the start.
 * Every other chart (horizontal bars, dot strips: category names sit on the left) keeps its
 * left edge, with a cue that the dots and bars lie to the right (a phone reader otherwise sees
 * a column of names and an empty axis), gone once the reader reaches the end. The chart decides, not a list of plates: Plot's figure carries its own scales
 * (plot.scale("x"), the hook addCrosshair uses too), and a time or utc x scale, or a band
 * scale over dates, is time. A chart built by hand from several Plot panels declares data-x on
 * its own SVG where it is built. The finding is written on the zone as data-x="time|other". */
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
      c.textContent = z.dataset.x === "time" ? "← Earlier years" : "More of the chart to the right →";
      z.before(c); cueOf.set(z, c);
    }
    return c;
  };
  const xKind = (z) => {
    if (z.dataset.x) return z.dataset.x;
    // a chart assembled by hand (several Plot panels in one SVG) declares data-x where it is built
    const declared = z.querySelector("svg[data-x], figure[data-x]")?.getAttribute("data-x");
    if (declared) return (z.dataset.x = declared === "time" ? "time" : "other");
    const fig = [...z.querySelectorAll("figure, svg")].find((el) => typeof el.scale === "function" && el.scale("x"));
    if (!fig) return "";   // not drawn yet (or not a Plot chart): decide on the next pass
    const x = fig.scale("x");
    // bars faceted by year (one panel per year, a few groups in each) are a time series too
    const fx = fig.scale("fx");
    if (fx?.domain?.length > 3 && fx.domain.every((v) => v instanceof Date || (typeof v === "number" && v > 1900 && v < 2200) || /^\d{4}/.test(String(v)))) return (z.dataset.x = "time");
    // a run of year labels on a category axis ("2000-01", "March 2023") is a time series drawn
    // as columns: it opens at the latest end too (src/charts/plot.js YEARISH)
    const yearish = /^(\d{4}(-\d{2,4})?|[A-Z][a-z]+ \d{4}|Q\d\b.*|FY ?\d{2,4})$/;
    const time = x.type === "time" || x.type === "utc"
      || ((x.type === "band" || x.type === "point") && x.domain?.length && (x.domain.every((v) => v instanceof Date) || (x.domain.length > 8 && x.domain.every((v) => yearish.test(String(v))))));
    return (z.dataset.x = time ? "time" : "other");
  };
  // the cue is hidden once the reader reaches the far end: the start for time, the end otherwise
  const done = (z) => z.dataset.x === "time" ? z.scrollLeft <= 4 : z.scrollLeft >= z.scrollWidth - z.clientWidth - 4;
  const update = (z) => {
    const kind = xKind(z);
    if (!kind) return;
    const max = z.scrollWidth - z.clientWidth;
    if (max <= 4) { if (cueOf.has(z)) cueOf.get(z).hidden = true; return; }
    if (kind === "time" && !touched.has(z)) { programmatic = true; z.scrollLeft = max; programmatic = false; }
    cue(z).hidden = done(z);
  };
  const all = () => zones.forEach(update);
  for (const z of zones) {
    z.addEventListener("scroll", () => {
      if (!programmatic) touched.add(z);
      if (cueOf.has(z)) cueOf.get(z).hidden = done(z) || z.scrollWidth - z.clientWidth <= 4;
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
