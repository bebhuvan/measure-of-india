// Schools guide: every plate drawn at build time with the chart kit, from the plates of
// schools.model.js (UDISE+ and the NSS education survey). Runs at build time only.
import { K, figure, pairRows, groupRows, inr, count, countTick, plateData, barsDraw, dumbbellDraw, barPanelsDraw } from "./survey-plates.js";
import { schoolFormat } from "./schools.format.js";

const pct = (v) => K.num(v, { dp: 1, suffix: "%" });
const PCT = { suffix: "%" };
const crore = (v) => K.num(v, { dp: 2 }) + " crore";

export function schoolChart(p, model) {
  const fig = (draw, desc, data = plateData(p)) => figure({ bare: true, file: `india-atlas_schools_${p.id}`, label: `${p.title}. ${desc}`, data, draw });
  const R = p.rows;
  switch (p.id) {
    case "enrolment-trend": {
      // two rulers, never joined: school-reported totals to 2021-22, pupil records from 2022-23
      const run = (re) => R.filter((r) => re.test(r.name)).map((r) => [r.parts[0].date, r.value / 1e7]);
      const totals = run(/school totals$/), records = run(/student records$/);
      if (totals.length + records.length !== R.length) throw Error("schools: enrolment rows on neither ruler");
      // the seam halfway between the last school-total year and the first pupil-record year
      const seamT = `${records[0][0].slice(0, 4) - 1}-10-01`, lastT = totals.at(-1);
      return fig((width) => K.line({ width, freq: "fy", unit: { suffix: " crore" }, endFormat: crore, endDp: 2, hoverDp: 2, zero: false,
        seam: { t: seamT, before: "School totals", after: "Pupil records" },
        notes: [{ d: lastT[0], v: lastT[1], text: `${crore(lastT[1])}\nSchool totals, ${R.find((r) => r.parts[0].date === lastT[0]).name.split(",")[0]}`, side: "left", below: true }],
        series: [{ name: "School totals", data: totals, role: "ctx", dots: true, label: false }, { name: "Pupil records", data: records, role: "lead", dots: true }] }),
      "Pupils enrolled, crore, each academic year: school-reported totals to 2021-22 and individual pupil records from 2022-23, drawn as two separate series.",
      { cols: ["year", "pupils", "count_basis"], rows: R.map((r) => [r.name.split(",")[0], r.value, r.name.split(", ")[1]]) });
    }
    case "stages":
      return fig(barsDraw(R.map((r) => ({ ...r, value: r.value / 1e7 })), { sort: false, fmt: crore, unit: { suffix: " crore" } }), "Pupils enrolled at each stage, crore.");
    case "ger": {
      const groups = groupRows(R, ["All children, ", "Scheduled Castes, ", "Scheduled Tribes, "], { prefix: true })
        .map((g) => ({ title: g.tag.slice(0, -2), rows: g.rows.map((r) => ({ ...r, highlight: r.name === "Higher secondary" })) }));
      return fig(barPanelsDraw(groups, { fmt: pct, unit: PCT, min: 300 }), "Gross enrolment ratio by stage, per cent, for all children, Scheduled Castes and Scheduled Tribes.");
    }
    case "girls":
      return fig(barsDraw(R, { sort: false, fmt: pct, unit: PCT, ref: { value: 50, label: "Half" }, refFill: false }), "Girls as a share of pupils at each stage, per cent.");
    case "states-ger": case "states-dropout": {
      const ref = model.facts[p.id === "states-ger" ? "higher_ger" : "dropout"].value;
      // a zero the printed UDISE+ report itself gives (its dropout floor) is drawn as printed, and said so
      const rows = R.map((r) => ({ ...r, note: r.value === 0 ? "published as zero" : undefined }));
      return fig(barsDraw(rows, { fmt: pct, unit: PCT, ref: { value: ref, label: `All-India ${pct(ref)}` } }), p.id === "states-ger" ? "Gross enrolment ratio at higher secondary, per cent, by state." : "Dropout rate in classes 9 and 10, per cent, by state.");
    }
    case "retention": case "transition": case "coaching":
      return fig(barsDraw(R, { sort: false, fmt: pct, unit: PCT }), "Per cent, in the order of the school stages.");
    case "management": {
      const groups = groupRows(R, [": schools", ": pupils", ": teachers"]).map((g, i) => ({ title: ["Schools", "Pupils", "Teachers"][i], rows: g.rows.map((r) => ({ ...r, highlight: r.name === "Government" })) }));
      return fig(barPanelsDraw(groups, { fmt: pct, unit: PCT, min: 300 }), "Each management type's share of schools, of pupils and of teachers, per cent.");
    }
    case "ptr":
      return fig(barsDraw(R, { sort: false, fmt: (v) => K.num(v, { dp: 0 }) }), "Pupils per teacher at each stage.");
    case "single-teacher": {
      // two units side by side, each on its own scale, beside the national total it is a part of
      const F = model.facts, groups = [
        { title: "Schools", rows: [{ name: "All recognised schools", value: F.schools.value }, { ...R[0], name: "With a single teacher", highlight: true }] },
        { title: "Pupils", rows: [{ name: "All pupils", value: F.enrolment.value }, { ...R[1], name: "In single-teacher schools", highlight: true }] },
      ];
      return fig(barPanelsDraw(groups, { fmt: count, tickFmt: countTick, own: true }), "Schools with a single teacher beside all recognised schools, and the pupils in them beside all pupils.");
    }
    case "facilities":
      return fig(barsDraw(R, { fmt: pct, unit: PCT }), "Schools reporting each facility, per cent.");
    case "working": {
      const rows = pairRows(R, ": works", ": exists").map((r) => ({ ...r, a: r.a / 1e5, b: r.b / 1e5 }));
      const lo = Math.floor(Math.min(...rows.map((r) => r.a)) / 0.5) * 0.5 - 0.5;
      return fig(dumbbellDraw(rows, { a: "Working", b: "Exists" }, { fmt: (v) => K.num(v, { dp: 2 }) + " lakh", unit: { suffix: " lakh" }, from: lo }), "Schools with each facility and schools where it works, lakh; the scale starts above zero to show the gap.");
    }
    case "school-type":
      return fig(dumbbellDraw(pairRows(R, ", rural", ", urban"), { a: "Rural", b: "Urban" }, { fmt: pct, unit: PCT }), "Per cent of enrolled pupils by type of school, rural and urban.");
    case "bill-type":
      return fig(dumbbellDraw(pairRows(R, ", rural", ", urban"), { a: "Rural", b: "Urban" }, { fmt: inr }), "Spending per pupil in the academic year, rupees, rural and urban.");
    case "bill-stage": case "coaching-bill":
      return fig(barsDraw(R, { sort: false, fmt: inr }), "Rupees per pupil in the academic year, by stage.");
    case "bill-items":
      return fig(barsDraw(R, { fmt: inr }), "Rupees per pupil in the academic year, by item.");
  }
  throw Error("schools: no chart for plate " + p.id);
}

export function schoolNumbers(model) {
  const N = {};
  for (const [id, f] of Object.entries(model.facts)) N["n-" + id] = schoolFormat(f.value, f.unit);
  for (const p of model.plates) N["pv-" + p.id] = schoolFormat(p.rows[0].value, p.rows[0].unit);
  return N;
}
