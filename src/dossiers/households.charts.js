// Households guide: every plate drawn at build time with the chart kit, from the plates of
// households.model.js (AIDIS, NSS 77th round). Rural and urban estimates are kept apart; each plate
// answers one question, so its form follows the question. Runs at build time only.
import { K, figure, pairRows, groupRows, inr, scaleFor, plateData, barsDraw, dumbbellDraw, barPanelsDraw } from "./survey-plates.js";
import { householdFormat } from "./households.format.js";

const RU = { a: "Rural", b: "Urban" };
const per1000 = (v) => K.num(v, { dp: 0 });
// rupee plates are drawn in lakh (or crore) so the scale reads; labels keep the rupee figure
function rupees(rowsOf, max) {
  const s = scaleFor(max, "inr");
  return { s, rows: rowsOf(s.k), fmt: (v) => inr(v * s.k), unit: { suffix: s.suffix } };
}
const scaled = (rows, k) => rows.map((r) => ({ ...r, a: r.a == null ? null : r.a / k, b: r.b == null ? null : r.b / k, value: r.value == null ? null : r.value / k }));
const sumOrder = (rows) => rows.slice().sort((p, q) => (q.a ?? 0) + (q.b ?? 0) - (p.a ?? 0) - (p.b ?? 0));

export function householdChart(p, model) {
  const label = (s) => `${p.title}. ${s}`;
  const fig = (draw, desc) => figure({ bare: true, file: `india-atlas_households_${p.id}`, label: label(desc), data: plateData(p), draw });
  const R = p.rows, max = Math.max(...R.map((r) => r.value));
  switch (p.id) {
    case "own-types": case "lenders": case "purpose": {
      const rows = sumOrder(pairRows(R, ", rural", ", urban"));
      return fig(dumbbellDraw(rows, RU, { fmt: per1000 }), "Per 1,000 rural and urban households.");
    }
    case "interest": {
      const rows = pairRows(R, ", rural", ", urban", { name: (k) => k });
      return fig(dumbbellDraw(rows, RU, { fmt: per1000 }), "Rupees per ₹1,000 of debt at each annual rate of interest, rural and urban.");
    }
    case "value-types": case "social": case "head-gender": case "capex": {
      const pr = pairRows(R, ", rural", ", urban");
      const { rows, fmt, unit } = rupees((k) => scaled(p.id === "value-types" ? sumOrder(pr) : pr, k), max);
      if (p.id === "social" || p.id === "capex") rows.forEach((r) => { r.highlight = /^All/.test(r.name); });
      return fig(dumbbellDraw(rows, RU, { fmt, unit }), "Average per household in rupees, rural and urban.");
    }
    case "deciles": case "loan-deciles": {
      const pr = pairRows(R, "Rural, ", "Urban, ", { prefix: true, name: (k) => k.replace(/^decile (\d+)$/, (_, n) => n === "1" ? "Decile 1, least assets" : n === "10" ? "Decile 10, most assets" : "Decile " + n) });
      if (p.id === "loan-deciles") return fig(dumbbellDraw(pr, RU, { fmt: per1000 }), "Households with a cash loan per 1,000, by asset decile, rural and urban.");
      const { rows, fmt, unit } = rupees((k) => scaled(pr, k), max);
      return fig(dumbbellDraw(rows, RU, { fmt, unit }), "Average assets per household by asset decile, rural and urban.");
    }
    case "gold": case "livelihood": case "debt-base": {
      const gr = groupRows(R, [", rural", ", urban"]).map((x, i) => ({ title: ["Rural", "Urban"][i], rows: x.rows.map((r) => ({ ...r, highlight: /^All/.test(r.name) })) }));
      if (p.id === "gold") return fig(barPanelsDraw(gr, { fmt: per1000, sort: false }), "Households with gold or jewellery per 1,000, rural and urban.");
      const s = scaleFor(max, "inr");
      const sg = gr.map((x) => ({ ...x, rows: x.rows.map((r) => ({ ...r, value: r.value / s.k })) }));
      return fig(barPanelsDraw(sg, { fmt: (v) => inr(v * s.k), unit: { suffix: s.suffix }, sort: p.id !== "debt-base" }), "Average per household in rupees, rural and urban.");
    }
    case "states-assets": case "states-loans": {
      const loans = p.id === "states-loans", ref = model.facts[loans ? "rural_incidence" : "rural_assets"].value;
      if (loans) return fig(barsDraw(R, { fmt: per1000, ref: { value: ref, label: `All-India ${per1000(ref)}` } }), "Rural households with a cash loan per 1,000, by state.");
      const s = scaleFor(max, "inr");
      return fig(barsDraw(R.map((r) => ({ ...r, value: r.value / s.k })), { fmt: (v) => inr(v * s.k), unit: { suffix: s.suffix }, ref: { value: ref / s.k, label: `All-India ${inr(ref)}` } }), "Average assets per rural household in rupees, by state.");
    }
  }
  throw Error("households: no chart for plate " + p.id);
}

/** The figures the page sets in its number ids, as the client used to: `n-<fact>` and `pv-<plate>`. */
export function householdNumbers(model) {
  const N = {};
  for (const [id, f] of Object.entries(model.facts)) N["n-" + id] = householdFormat(f.value, f.unit);
  for (const p of model.plates) N["pv-" + p.id] = householdFormat(p.rows[0].value, p.rows[0].unit);
  return N;
}
