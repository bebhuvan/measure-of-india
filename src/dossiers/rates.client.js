// Interest rates guide: the only browser code left is the sortable tables under the MCLR and
// state-borrowing plates. The charts are drawn at build time (src/dossiers/rates.charts.js) and
// every number is set in the page's frontmatter, so no bundle reaches the reader.

document.querySelectorAll("table.sortable").forEach((t) => {
  t.querySelectorAll("th").forEach((th, col) => th.addEventListener("click", () => {
    const num = th.dataset.sort === "n", dir = th.dataset.dir === "asc" ? -1 : 1; th.dataset.dir = dir === 1 ? "asc" : "desc";
    const key = (tr) => { const v = tr.children[col].textContent.replace(/[%,₹\s]/g, ""); return num ? (v === "" ? -Infinity : +v) : v.toLowerCase(); };
    const rows = [...t.tBodies[0].rows].sort((a, b) => (key(a) > key(b) ? dir : key(a) < key(b) ? -dir : 0));
    t.tBodies[0].append(...rows);
  }));
});
