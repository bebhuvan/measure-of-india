// State economies guide: the one control left in the browser, the sortable every-state table
// (§ 08). Rows, figures and sort keys are written at build time by src/dossiers/states.charts.js
// (each <tr> carries data-<column>); this only reorders them. No data is fetched or embedded.
const body = document.getElementById("st-body");
const rows = body ? [...body.rows] : [];
document.querySelectorAll("#st-table th button").forEach((btn) => btn.addEventListener("click", () => {
  const k = btn.dataset.k, desc = btn.getAttribute("aria-sort") !== "descending";
  document.querySelectorAll("#st-table th button").forEach((b) => b.removeAttribute("aria-sort"));
  btn.setAttribute("aria-sort", desc ? "descending" : "ascending");
  const val = (r) => { const v = r.dataset[k]; return v == null ? null : k === "name" ? v : +v; };
  rows.sort((a, b) => {
    const x = val(a), y = val(b);
    if (x == null && y == null) return 0; if (x == null) return 1; if (y == null) return -1;
    const c = typeof x === "string" ? x.localeCompare(y) : x - y;
    return desc ? -c : c;
  });
  body.append(...rows);
}));
