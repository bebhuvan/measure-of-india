// src/dossiers/home.client.js: the home page search.
// The index (/search-index.json, built from data/series) loads on first focus, not on page load.
// Every word typed must match; matches in the series name rank above matches in its context.
// A few plain-language synonyms widen the search, so "inflation" finds price indices.
const q = document.getElementById("q");
const res = document.getElementById("results");
if (q && res) {
  const SYN = {
    inflation: ["price", "cpi", "wpi"], prices: ["price"], jobs: ["unemployment", "labour", "employment", "plfs"],
    rupee: ["usd", "inr", "exchange", "dollar"], dollar: ["usd"], growth: ["gdp", "gva"], factory: ["manufactur", "iip", "factor"],
    factories: ["factor"], college: ["enrolment", "aishe"], women: ["female", "gender", "sex ratio"], solar: ["solar"], power: ["electricity", "power"],
  };
  let INDEX = null, loading = null, hits = [], sel = -1;
  const load = () => loading ??= fetch("/search-index.json").then((r) => r.json()).then((j) => {
    INDEX = j; j.hay = j.rows.map((r) => (r[0] + " " + r[1] + " " + (j.guides[r[4]] || "")).toLowerCase()); return j; });
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  const reEsc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const spark = (vals) => {
    const v = vals.filter((x) => x != null); if (v.length < 2) return "";
    const w = 84, h = 22, lo = Math.min(...v), hi = Math.max(...v);
    const d = v.map((q, i) => `${i ? "L" : "M"}${(3 + i / (v.length - 1) * (w - 8)).toFixed(1)},${(3 + (hi - q) / ((hi - lo) || 1) * (h - 7)).toFixed(1)}`).join("");
    const ly = 3 + (hi - v.at(-1)) / ((hi - lo) || 1) * (h - 7);
    return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" aria-hidden="true"><path d="${d}" fill="none" stroke="#2E4BD8" stroke-width="1.3" stroke-linejoin="round"/><circle cx="${w - 5}" cy="${ly.toFixed(1)}" r="2.2" fill="#2E4BD8"/></svg>`;
  };
  function search() {
    const words = q.value.toLowerCase().trim().split(/\s+/).filter(Boolean);
    if (!words.length || !INDEX) { res.hidden = true; q.setAttribute("aria-expanded", "false"); return; }
    const alts = words.map((w) => [w, ...(SYN[w] || [])]);
    const scored = [];
    INDEX.hay.forEach((h, i) => {
      if (!alts.every((a) => a.some((w) => h.includes(w)))) return;
      const name = INDEX.rows[i][0].toLowerCase();
      const score = alts.reduce((s, a) => s + (a.some((w) => name.includes(w)) ? 2 : 1), 0) - name.length / 300;
      scored.push([score, i]);
    });
    scored.sort((a, b) => b[0] - a[0]);
    hits = scored.slice(0, 8).map(([, i]) => INDEX.rows[i]);
    sel = hits.length ? 0 : -1;
    const hl = (s) => words.filter((w) => w.length > 1).reduce((o, w) => o.replace(new RegExp(`(${reEsc(w)})`, "ig"), "<mark>$1</mark>"), esc(s));
    res.innerHTML = hits.length
      ? hits.map((r, i) => `<li role="option" id="opt${i}" aria-selected="${i === sel}" data-href="${r[4] ? `/guides/${r[4]}/` : "/register/"}">
          <div class="rn">${hl(r[0])}<span class="rm">${esc([INDEX.guides[r[4]], r[1]].filter(Boolean).join(", "))}</span></div>
          <div class="rs">${spark(r[5])}</div><div class="rv">${esc(r[2])}<small>${esc(r[3])}</small></div></li>`).join("") +
        `<li class="count" aria-hidden="true">${scored.length.toLocaleString("en-IN")} ${scored.length === 1 ? "series matches" : "series match"}</li>`
      : `<li class="none">No series matches “${esc(q.value)}”. Try a broader word, such as prices, output or a state's name.</li>`;
    res.hidden = false; q.setAttribute("aria-expanded", "true");
    res.querySelectorAll("li[data-href]").forEach((li) => li.addEventListener("mousedown", (e) => { e.preventDefault(); location.href = li.dataset.href; }));
  }
  q.addEventListener("focus", () => load().then(search), { once: true });
  q.addEventListener("input", () => (INDEX ? search() : load().then(search)));
  q.addEventListener("keydown", (e) => {
    if (e.key === "Escape") { res.hidden = true; q.setAttribute("aria-expanded", "false"); return; }
    if (res.hidden || !hits.length) return;
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault(); sel = (sel + (e.key === "ArrowDown" ? 1 : -1) + hits.length) % hits.length;
      res.querySelectorAll("li[role=option]").forEach((li, i) => li.setAttribute("aria-selected", i === sel));
      q.setAttribute("aria-activedescendant", "opt" + sel);
    }
    if (e.key === "Enter" && sel >= 0) location.href = res.querySelectorAll("li[role=option]")[sel].dataset.href;
  });
  q.addEventListener("blur", () => setTimeout(() => { res.hidden = true; q.setAttribute("aria-expanded", "false"); }, 150));
}
// "/" jumps to search from anywhere on the page
document.addEventListener("keydown", (e) => {
  if (e.key !== "/" || /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName)) return;
  const box = document.getElementById("q");
  if (box) { e.preventDefault(); box.focus(); }
});
