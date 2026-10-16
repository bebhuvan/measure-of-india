// Digital access guide: every plate drawn at build time with the chart kit, from the plates of
// digital-access.model.js (CMS: Telecom, NSS 80th round). Runs at build time only.
import { K, figure, pairRows, groupRows, barsDraw, dumbbellDraw, barPanelsDraw } from "./survey-plates.js";
import { digitalFormat } from "./digital-access.format.js";

const pct = (v) => K.num(v, { dp: 1, suffix: "%" });
const PCT = { suffix: "%" };
const VT = { a: "Villages", b: "Towns and cities" };
const VILL = [", villages", ", towns and cities"];

// the CSV the client used to build: every published field, the state sample and sampling error kept
const data = (p) => ({
  cols: ["cut", "value", "unit", "period", "bundle", "series", "state_survey_households", "rse_percent"],
  rows: p.rows.map((r) => [r.name, r.value, p.unit, p.period, r.bundle ?? p.bundle, r.series, r.quality?.households ?? null, r.quality?.rse ?? null]),
});

export function digitalChart(p, model) {
  const fig = (draw, desc) => figure({ bare: true, file: `india-atlas_digital-access_${p.id}`, label: `${p.title}. ${desc}`, data: data(p), draw });
  const R = p.rows;
  switch (p.id) {
    case "home-internet": case "shopping":
      return fig(barsDraw(R.map((r, i) => ({ ...r, highlight: i === 0 })), { sort: false, fmt: pct, unit: PCT }), "Per cent of all households: all homes, villages, and towns and cities.");
    case "home-network": case "home-offline": case "phone-type": case "frequency": case "device": case "payments": case "goods":
      return fig(dumbbellDraw(pairRows(R, ...VILL), VT, { fmt: pct, unit: PCT }), "Per cent, villages against towns and cities.");
    case "ladder-sector":
      return fig(dumbbellDraw(pairRows(R, ...VILL), VT, { fmt: pct, unit: PCT }), "Per cent of people aged 15 and above, villages against towns and cities.");
    case "ladder-gender": case "skills-gender":
      return fig(dumbbellDraw(pairRows(R, ", women", ", men"), { a: "Women", b: "Men" }, { fmt: pct, unit: PCT, sortBy: p.id === "skills-gender" ? "b" : "none" }), "Per cent of people aged 15 and above, women against men.");
    case "skills-sector":
      return fig(dumbbellDraw(pairRows(R, ...VILL), VT, { fmt: pct, unit: PCT, sortBy: "b" }), "Per cent of people aged 15 and above, villages against towns and cities.");
    case "skills-age":
      return fig(dumbbellDraw(pairRows(R, ", all aged 15 and above", ", aged 15 to 24"), { a: "All aged 15 and above", b: "Aged 15 to 24" }, { fmt: pct, unit: PCT, sortBy: "b" }), "Per cent, people aged 15 to 24 against all people aged 15 and above.");
    case "ladder-age": {
      // three overlapping age groups for each rung: one panel per rung, on one scale
      const rungs = ["Used a mobile phone, ", "Owns a mobile phone, ", "Used the internet, "];
      const groups = groupRows(R, rungs, { prefix: true }).map((g) => ({ title: g.tag.slice(0, -2), rows: g.rows.map((r) => ({ ...r, highlight: r.name === "Aged 15 to 24" })) }));
      return fig(barPanelsDraw(groups, { fmt: pct, unit: PCT, min: 300, max: 100 }), "Per cent of people in each age group, for each of three questions.");
    }
    case "skills":
      return fig(barsDraw(R, { fmt: pct, unit: PCT }), "Per cent of people aged 15 and above reporting each task.");
    case "states-home-internet": case "states-internet-use": {
      const f = model.facts[p.id === "states-home-internet" ? "householdInternet" : "personInternet"].value;
      return fig(barsDraw(R, { fmt: pct, unit: PCT, ref: { value: f, label: `All-India ${pct(f)}` } }), "Per cent, by state, ranked; the rule marks the all-India figure.");
    }
  }
  throw Error("digital-access: no chart for plate " + p.id);
}

export function digitalNumbers(model) {
  const N = {};
  for (const [id, f] of Object.entries(model.facts)) N["n-" + id] = digitalFormat(f.value, f.unit);
  for (const p of model.plates) N["pv-" + p.id] = digitalFormat(p.rows[0].value, p.unit);
  return N;
}
