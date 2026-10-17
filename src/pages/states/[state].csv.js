// /states/<state>.csv: every series in Measure of India's guides that names this state or UT (or a
// former unit it succeeds, labelled as such), with its latest value, period, unit and a link to
// its every-cut row. Built from the baked bundles (src/dossiers/profiles.js rowsForState).
import { STATES } from "../../dossiers/states-key.js";
import { rowsForState } from "../../dossiers/profiles.js";
import { bySlug } from "../../dossiers/registry.js";
import { SITE } from "../../site.js";

export function getStaticPaths() {
  return STATES.map((u) => ({ params: { state: u.slug } }));
}
const cell = (c) => { const t = c == null ? "" : String(c); return /[",\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t; };
export function GET({ params }) {
  const rows = rowsForState(params.state);
  const head = ["guide", "bundle", "series", "label", "latest", "period", "unit", "former_unit", "row_link", "bundle_csv"];
  const lines = [head.join(",")];
  for (const r of rows) lines.push([bySlug[r.guide]?.title ?? r.guide, r.bundle, r.key, r.label, r.latest, r.period, r.unit, r.former ?? "", SITE.url + r.href, `${SITE.url}/data/${r.bundle}.csv`].map(cell).join(","));
  return new Response(lines.join("\n") + "\n", { headers: { "Content-Type": "text/csv; charset=utf-8" } });
}
