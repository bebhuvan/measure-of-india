// src/dossiers/everycut.client.js: sorting, filtering and folding for the every-cut tables
// (src/components/EveryCutTable.astro). Every row is already in the HTML; this only
// reorders and hides rows. No data is fetched.
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
  const total = rows.length;
  let open = false;
  // what a row is searched and filtered by: its own text, read once from the cells
  for (const tr of rows) {
    tr._facet = tr.cells[1].textContent.trim();
    tr._s = (tr.cells[0].textContent + " " + tr._facet).toLowerCase();
  }

  const apply = () => {
    const needle = (q?.value || "").trim().toLowerCase();
    const terms = needle ? needle.split(/\s+/) : [];
    const fc = fFacet?.value || "", fl = fFile?.value || "";
    const filtered = !!(terms.length || fc || fl);
    let shown = 0, match = 0;
    for (const tr of tbody.rows) {
      const ok = (!fc || tr._facet === fc) && (!fl || tr.dataset.file === fl) && terms.every((t) => tr._s.includes(t));
      if (ok) match++;
      const vis = ok && (open || filtered || match <= fold);
      tr.hidden = !vis;
      if (vis) shown++;
    }
    if (count) count.textContent = filtered ? `${match.toLocaleString("en-IN")} of ${total.toLocaleString("en-IN")} series` : `${total.toLocaleString("en-IN")} series`;
    if (more) more.hidden = open || filtered || total <= fold;
    if (none) none.hidden = match > 0;
  };

  // sort: text columns A to Z first, numbers largest first; blanks always last
  let sortKey = null, dir = 1;
  const val = (tr, k) => (k === "label" ? tr.cells[0].firstChild.textContent : k === "facet" ? tr._facet : tr.dataset[k]);
  for (const btn of root.querySelectorAll("th button[data-sort]")) {
    btn.addEventListener("click", () => {
      const k = btn.dataset.sort, numeric = k === "v" || k === "c";
      if (sortKey === k) dir = -dir; else { sortKey = k; dir = numeric ? -1 : 1; }
      for (const th of root.querySelectorAll("th")) th.removeAttribute("aria-sort");
      btn.closest("th").setAttribute("aria-sort", dir > 0 ? "ascending" : "descending");
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
      apply();
    });
  }
  q?.addEventListener("input", apply);
  fFacet?.addEventListener("change", apply);
  fFile?.addEventListener("change", apply);
  more?.addEventListener("click", () => { open = true; apply(); });
  apply();
}
