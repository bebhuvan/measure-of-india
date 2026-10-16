// Guide 15, merchandise trade: the every-cut explorer, the page's one interactive control.
// The plates are drawn at build time (src/dossiers/trade.charts.js); this script only runs the
// lookup table. Its chapter and partner tables are embedded by trade.astro (#trade-xp); the
// finer tables (/data/<bundle>.json, static files) are fetched only when a reader asks.

import { pct1Minus } from "../charts/format.js";

const E = JSON.parse(document.getElementById("trade-xp")?.textContent || "null");
const esc = (v) => String(v).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const setHTML = (id, h) => { const el = document.getElementById(id); if (el) el.innerHTML = h; };
const fyOf = (iso) => `${iso.slice(0, 4)}-${String((+iso.slice(0, 4) + 1) % 100).padStart(2, "0")}`;
const csvRows = (header, rows) => [header.join(","), ...rows.map((r) => r.map((v) => (v == null ? "" : /[",]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : v)).join(","))].join("\n");
function saveBlob(blob, filename) {
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = filename;
  document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

if (E) {
  const lvl = document.getElementById("xp-level"), flow = document.getElementById("xp-flow"), q = document.getElementById("xp-q");
  const body = document.getElementById("xp-body");
  // US$ million: whole millions, except small lines that would round to nothing (the CSV keeps every decimal)
  const xpVal = (v) => (v == null ? "—" : v.toLocaleString("en-IN", { maximumFractionDigits: Math.abs(v) < 10 ? 2 : 0 }));
  const cache = new Map();
  let state = { rows: [], fyLabels: ["", ""], sortK: "cur", sortDir: -1, file: null };
  async function load(file) {
    if (!cache.has(file)) cache.set(file, fetch(`/data/${file}.json`).then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); }));
    return cache.get(file);
  }
  // a bundle -> table rows: annual bundles compare their last two years
  function fromAnnual(b, i) {
    const n = i ?? b.dates.length - 1;
    return { fy: [fyOf(b.dates[n]), n > 0 ? fyOf(b.dates[n - 1]) : ""], rows: Object.entries(b.series ?? {}).map(([k, s]) => [k, s.label, s.data[n], n > 0 ? s.data[n - 1] : null]) };
  }
  const code = (k, label) => (label.match(/\(HS (\d+)\)/)?.[1] ?? k.replace(/^c/, "").replace(/__c/, " / "));
  function render() {
    const term = q.value.trim().toLowerCase();
    let rows = state.rows.map(([k, label, cur, prev]) => ({ code: code(k, label), label: label.replace(/\s*\(HS \d+\)/, ""), cur, prev, chg: cur != null && prev != null && prev !== 0 ? (cur / prev - 1) * 100 : null }))
      .filter((r) => r.code !== "total" && (!term || r.label.toLowerCase().includes(term) || r.code.includes(term)));
    rows.sort((a, b) => { const x = a[state.sortK], y = b[state.sortK]; if (x == null) return 1; if (y == null) return -1; return (typeof x === "string" ? x.localeCompare(y) : x - y) * state.sortDir; });
    const shown = rows.slice(0, 400);
    body.innerHTML = shown.map((r) => `<tr><td class="c">${esc(r.code)}</td><td>${esc(r.label)}</td><td class="n">${xpVal(r.cur)}</td><td class="n">${xpVal(r.prev)}</td><td class="n">${r.chg == null ? "—" : pct1Minus(r.chg)}</td></tr>`).join("");
    setHTML("xp-n", `${rows.length.toLocaleString("en-IN")} rows${rows.length > shown.length ? `, first ${shown.length} shown; the CSV has all` : ""}`);
    setHTML("xp-h-cur", state.fyLabels[0] || "Latest");
    setHTML("xp-h-prev", state.fyLabels[1] || "Year before");
    state.filtered = rows;
  }
  async function update() {
    const L = lvl.value, F = flow.value;
    try {
      if (L === "hs2" || L === "partners") {
        const src = L === "hs2" ? (F === "exports" ? E.hs2x : E.hs2m) : (F === "exports" ? E.px : E.pm);
        const b = { dates: src.dates, series: Object.fromEntries(src.rows.map(([k, label, data]) => [k, { label, data }])) };
        const r = fromAnnual(b); state.rows = r.rows; state.fyLabels = r.fy;
      } else if (L === "hs4" || L === "cxc") {
        setHTML("xp-n", "Loading…");
        const b = await load(L === "hs4" ? `trade-hs4-${F}-fy` : `trade-partner-hs2-${F}`);
        const r = fromAnnual(b); state.rows = r.rows; state.fyLabels = r.fy;
      }
    } catch (e) {
      state.rows = []; setHTML("xp-n", "This table could not be loaded here; it is in the data downloads below.");
    }
    render();
  }
  lvl?.addEventListener("change", update);
  flow?.addEventListener("change", update);
  q?.addEventListener("input", render);
  document.querySelectorAll("#cb-every th[data-k]").forEach((th) => th.addEventListener("click", () => { const k = th.dataset.k; state.sortDir = state.sortK === k ? -state.sortDir : (k === "label" || k === "code" ? 1 : -1); state.sortK = k; render(); }));
  document.getElementById("xp-csv")?.addEventListener("click", () => saveBlob(new Blob([csvRows(["code", "description", state.fyLabels[0] || "latest", state.fyLabels[1] || "previous", "change_pct"], (state.filtered || []).map((r) => [r.code, r.label, r.cur, r.prev, r.chg == null ? "" : r.chg.toFixed(2)]))], { type: "text/csv" }), `india-atlas_trade-every-cut-${lvl.value}-${flow.value}.csv`));
  if (body) update();
}
