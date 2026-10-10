// Family health (NFHS): the plates. Data is the inline JSON the page builds at build time
// (src/dossiers/nfhs.data.js), never a runtime fetch. The two survey rounds are two rulers: a
// plate sets NFHS-4 (grey dot) beside NFHS-5 (blue dot), and never draws a line of change
// through them as if they were a series; the connector between the dots is a hairline that says
// "same measure, two surveys". A state strip ranks the states on one round, with India's
// figure as a labelled rule.
import { ACC, INK, G1, G2, G3, GOLD, f1, toCsv, wire, mount, dumbbell, stateStrip, divBars } from "./health-gender.charts.js";

const D = JSON.parse(document.getElementById("nfhs-data").textContent);
/* ---------- §03 what changed between the rounds ---------- */
{
  const rows = D.direction.map((r) => ({ label: r.short, v: r.change, c: r.dir === 0 ? G3 : r.dir * r.change < 0 ? ACC : G2 }));
  const p = divBars(mount("plot-direction"), rows, { title: "Change between NFHS-4 and NFHS-5, every per-cent measure taken both times", desc: `${rows.length} measures`, xLabel: "change, percentage points →" });
  wire("cb-direction", p, "nfhs-change", toCsv(["measure", "nfhs4", "nfhs5", "change_points", "direction"], D.direction.map((r) => [r.label, r.a, r.b, r.change, r.dir === 0 ? "no direction" : r.dir * r.change < 0 ? "worse" : "better"])));
}
/* ---------- dumbbell plates ---------- */
const DUMB = [
  ["anaemia", "Anaemia by group, NFHS-4 and NFHS-5", {}],
  ["nutrition", "Children's nutrition, NFHS-4 and NFHS-5", {}],
  ["mortality", "Deaths per 1,000 live births, NFHS-4 and NFHS-5", { fmt: (v) => v.toFixed(0) }],
  ["vaccines", "Vaccination and childhood illness, NFHS-4 and NFHS-5", {}],
  ["births", "Care before, during and after birth, NFHS-4 and NFHS-5", {}],
  ["household", "The household, NFHS-4 and NFHS-5", {}],
  ["fp", "Family planning, married women 15-49, NFHS-4 and NFHS-5", {}],
];
for (const [k, title, o] of DUMB) {
  const el = mount("plot-" + k);
  if (!el || !D[k]) continue;
  const p = dumbbell(el, D[k], { title, desc: D[k].map((r) => `${r.label}: ${r.a == null ? "" : f1(r.a) + " then "}${f1(r.b)}`).join("; "), ...o });
  wire("cb-" + k, p, "nfhs-" + k, toCsv(["measure", "nfhs4", "nfhs5"], D[k].map((r) => [r.label, r.a, r.b])));
}
/* ---------- NFHS-6 beside the NFHS-5 figures its own fact sheets print ---------- */
{
  const el = mount("plot-nfhs6");
  if (el && D.nfhs6) {
    const p = dumbbell(el, D.nfhs6, { title: "Selected measures, India, NFHS-5 and NFHS-6", desc: D.nfhs6.map((r) => `${r.label}: ${r.a == null ? "" : f1(r.a) + " then "}${f1(r.b)}`).join("; ") });
    wire("cb-nfhs6", p, "nfhs-6", toCsv(["measure", "nfhs5", "nfhs6"], D.nfhs6.map((r) => [r.label, r.a, r.b])));
  }
}
/* ---------- rural and urban, NFHS-5 (grey village, blue town) ---------- */
for (const k of ["ncd", "women"]) {
  const el = mount("plot-" + k);
  if (!el || !D[k]) continue;
  const rows = D[k].map((r) => ({ label: r.label, a: r.rural, b: r.urban }));
  const p = dumbbell(el, rows, { title: `${k === "ncd" ? "Blood sugar and blood pressure" : "Women's lives"}, villages and towns, NFHS-5` });
  wire("cb-" + k, p, "nfhs-" + k, toCsv(["measure", "rural", "urban", "total"], D[k].map((r) => [r.label, r.rural, r.urban, r.total])));
}
/* ---------- state strips ---------- */
const STRIPS = [
  ["anaemia-states", [{ key: "v", color: ACC }, { key: "v4", color: G1 }], "Children 6-59 months anaemic, NFHS-5 (blue) and NFHS-4 (grey), by state"],
  ["ncd-states", [{ key: "women", color: ACC }, { key: "men", color: GOLD }], "High blood pressure or on medicine, women (blue) and men (marigold), by state, NFHS-5"],
  ["cancer-states", [{ key: "cervical", color: ACC }, { key: "breast", color: GOLD }], "Women 30-49 ever screened: cervical (blue), breast (marigold), by state, NFHS-5"],
  ["women-states", [{ key: "phone", color: ACC }, { key: "bank", color: GOLD }], "Women with a phone (blue) and a bank account (marigold) they use, by state, NFHS-5"],
  ["violence-states", [{ key: "v", color: ACC }], "Married women ever hurt by a husband, by state, NFHS-5"],
  ["tobacco-states", [{ key: "men", color: GOLD }, { key: "women", color: ACC }], "Tobacco use, men (marigold) and women (blue), by state, NFHS-5"],
  ["tfr-states", [{ key: "v", color: ACC }, { key: "v4", color: G1 }], "Children per woman, NFHS-5 (blue) and NFHS-4 (grey), by state"],
  ["cs-states", [{ key: "private", color: GOLD }, { key: "public", color: ACC }], "Share of births by caesarean, private (marigold) and public (blue) facilities, by state, NFHS-5"],
];
for (const [k, series, title] of STRIPS) {
  const el = mount("plot-" + k), S = D[k];
  if (!el || !S) continue;
  const p = stateStrip(el, S.rows, series, { ref: S.ref, refLabel: S.refLabel, title, desc: `${S.rows.length} states and union territories`, fmt: S.fmt === "2" ? (v) => v.toFixed(2) : f1 });
  wire("cb-" + k, p, "nfhs-" + k, toCsv(["state", ...series.map((s) => s.key)], S.rows.map((r) => [r.geo, ...series.map((s) => r[s.key])])));
}
/* ---------- village and town: the urban minus rural gap, NFHS-5 ---------- */
{
  const el = mount("plot-gap");
  if (el) {
    const rows = D.gap.map((r) => ({ label: r.short, v: r.gap, c: r.gap >= 0 ? G2 : GOLD }));
    const p = divBars(el, rows, { title: "Town minus village, every per-cent measure, NFHS-5", xLabel: "towns higher →" });
    wire("cb-gap", p, "nfhs-rural-urban", toCsv(["measure", "rural", "urban", "urban_minus_rural"], D.gap.map((r) => [r.label, r.rural, r.urban, r.gap])));
  }
}
/* ---------- the state table: an HTML grid, each column shaded on its own range ---------- */
{
  const el = mount("plot-table");
  if (el) {
    const T = D.table;
    const tint = (v, lo, hi, bad) => {
      if (v == null || bad == null) return "transparent";   // a column with no worse end is not shaded
      const t = (v - lo) / (hi - lo || 1), w = bad ? t : 1 - t;   // the darker cell is the worse end
      return `rgba(46,75,216,${(0.03 + 0.27 * w).toFixed(3)})`;
    };
    const ranges = T.cols.map((c, j) => { const vs = T.rows.map((r) => r.v[j]).filter((v) => v != null); return [Math.min(...vs), Math.max(...vs)]; });
    el.innerHTML = `<div class="nf-table-wrap"><table class="nf-table"><thead><tr><th>State or UT</th>${T.cols.map((c) => `<th>${c.short}</th>`).join("")}</tr></thead><tbody>` +
      [T.india, ...T.rows].map((r, i) => `<tr${i === 0 ? ' class="ai"' : ""}><td>${r.geo}</td>${r.v.map((v, j) => `<td style="background:${i === 0 ? "transparent" : tint(v, ranges[j][0], ranges[j][1], T.cols[j].bad)}">${v == null ? "—" : f1(v)}</td>`).join("")}</tr>`).join("") +
      `</tbody></table></div>`;
    wire("cb-table", null, "nfhs-states-table", toCsv(["state", ...T.cols.map((c) => c.label)], [T.india, ...T.rows].map((r) => [r.geo, ...r.v])));
  }
}
