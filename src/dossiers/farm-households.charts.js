// Farm households guide: every plate drawn at build time with the chart kit, from the plates of
// farm-households.model.js (Situation Assessment Survey, NSS 77th round). Runs at build time only.
import { K, figure, pairRows, inr, count, countTick, plateData, barsDraw, dumbbellDraw } from "./survey-plates.js";
import { farmFormat } from "./farm-households.format.js";

const per1000 = (v) => K.num(v, { dp: 0 });
const pct = (v) => K.num(v, { dp: 1, suffix: "%" });
const lead = (rows, pick) => rows.map((r, i) => ({ ...r, highlight: pick(r, i) }));
const top = (rows) => { const m = Math.max(...rows.map((r) => r.value)); return lead(rows, (r) => r.value === m); };

export function farmChart(p, model) {
  const fig = (draw, desc) => figure({ bare: true, file: `india-atlas_farm-households_${p.id}`, label: `${p.title}. ${desc}`, data: plateData(p), draw });
  const R = p.rows;
  switch (p.id) {
    case "income-sources":
      // pensions and remittances sit outside the survey's income total: drawn grey, after the rest
      return fig(barsDraw(R.map((r) => /outside the total/.test(r.name) ? { ...r, color: K.C.ctx2 } : { ...r, highlight: r.name === "Wages" }), { sort: false, fmt: inr }), "Average monthly income per agricultural household by source, rupees.");
    case "income-land": case "debt-land":
      return fig(barsDraw(R, { sort: false, fmt: inr }), "Rupees per agricultural household, by land possessed, smallest holdings first.");
    case "investment":
      return fig(barsDraw(R, { sort: false, fmt: inr }), "Average monthly net investment per agricultural household, rupees, by land possessed; a negative value means more was sold than bought.");
    case "indebted-land":
      return fig(barsDraw(R, { sort: false, fmt: per1000 }), "Indebted households per 1,000, by land possessed, smallest holdings first.");
    case "income-mix":
      return fig(dumbbellDraw(pairRows(R, "Crops, ", "Wages, ", { prefix: true, name: (k) => k }), { a: "Crops", b: "Wages" }, { fmt: inr }), "Average monthly wage and crop income per agricultural household, rupees, by land possessed.");
    case "own-inputs":
      return fig(dumbbellDraw(pairRows(R, ", own inputs counted", ", cash costs only"), { a: "Own inputs counted", b: "Cash costs only" }, { fmt: inr }), "Average monthly income, rupees, with and without the family's own labour and inputs valued.");
    case "income-social": {
      const all = R.find((r) => r.name === "All agricultural households");
      return fig(barsDraw(R.filter((r) => r !== all), { sort: false, fmt: inr, ref: { value: all.value, label: `All farm households ${inr(all.value)}` } }), "Average monthly income per agricultural household by social group, rupees; the rule marks all farm households.");
    }
    case "income-states": case "debt-states": {
      const f = model.facts[p.id === "income-states" ? "paid_income" : "debt"].value;
      return fig(barsDraw(R, { fmt: inr, ref: { value: f, label: `All-India ${inr(f)}` } }), "Rupees per agricultural household, by state, ranked; the rule marks the all-India figure.");
    }
    case "crop-costs": case "animals":
      return fig(barsDraw(top(R), { fmt: inr }), "Average monthly rupees per household, ranked.");
    case "land-classes": {
      // published in hundreds of households; drawn as households
      const rows = R.map((r) => ({ ...r, value: r.value * 100 }));
      return fig(barsDraw(rows, { sort: false, fmt: count, tickFmt: countTick }), "Estimated agricultural households by land possessed, smallest holdings first.");
    }
    case "lease-terms":
      return fig(dumbbellDraw(pairRows(R, ", July–December 2018", ", January–June 2019"), { a: "July–December 2018", b: "January–June 2019" }, { fmt: pct, unit: { suffix: "%" } }), "Per cent of leased land under each kind of lease, in the two survey seasons.");
    case "msp":
      return fig(dumbbellDraw(pairRows(R, "Wheat sellers who ", "Paddy sellers who ", { prefix: true }), { a: "Wheat", b: "Paddy" }, { fmt: per1000 }), "Paddy and wheat sellers per 1,000 at each step from knowing the support price to selling at it.");
    case "insurance":
      return fig(dumbbellDraw(pairRows(R, "Wheat, ", "Paddy, ", { prefix: true }), { a: "Wheat", b: "Paddy" }, { fmt: per1000 }), "Paddy and wheat growers per 1,000, by whether they insured the crop.");
    case "paddy-sales": case "sale-complaints": case "uninsured-why": case "losses": case "lenders":
      return fig(barsDraw(top(R), { fmt: per1000 }), "Per 1,000, ranked.");
  }
  throw Error("farm-households: no chart for plate " + p.id);
}

export function farmNumbers(model) {
  const N = {};
  for (const [id, f] of Object.entries(model.facts)) N["n-" + id] = farmFormat(f.value, f.unit);
  for (const p of model.plates) N["pv-" + p.id] = farmFormat(p.rows[0].value, p.rows[0].unit);
  return N;
}
