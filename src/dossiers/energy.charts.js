// Energy guide: every plate drawn at build time with the chart kit, from the plates of
// energy.model.js (MoSPI Energy Statistics India 2026, Ember). Runs at build time only.
import { K, figure, barsDraw } from "./survey-plates.js";
import { energyFormat, energyUnitLabel } from "./energy.format.js";

// short units for a scale's top tick; the plate's sub names the unit in full
const TICK = { mtoe: " Mtoe", twh: " TWh", pct: "%", mwh_per_person: " MWh", mt_co2e: " Mt", g_co2e_per_kwh: " g/kWh", gwh: " GWh" };

// the CSV the client used to build: one row per drawn value, with its source address
const data = (p) => ({
  cols: ["measure", "value", "unit", "period", "bundle", "series"],
  rows: p.rows.map((r) => [r.name, r.value ?? null, r.unit, r.date, r.bundle, r.series]),
});

export function energyChart(p) {
  // chart labels at a precision the eye can use (932.82 Mtoe reads as 933 Mtoe, like the headline);
  // the page's figures keep energyFormat's published precision
  const sig = (v) => v == null ? v : +v.toFixed(Math.abs(v) >= 100 ? 0 : Math.abs(v) >= 10 ? 1 : 2);
  const fmt = (v) => energyFormat(sig(v), p.unit), unit = { suffix: TICK[p.unit] ?? "" };
  const fig = (draw, desc) => figure({ bare: true, file: `india-atlas_energy_${p.id}`, label: `${p.title}. ${desc}`, data: data(p), draw });
  if (p.kind === "history") {
    // the balance's financial years start in April; Ember's calendar years in January
    const fy = p.rows.every((r) => r.date.slice(5, 7) === "04");
    const series = [{ name: p.title, data: p.rows.map((r) => [r.date, r.value]), role: "lead" }];
    return fig((width) => K.line({ width, series, freq: fy ? "fy" : "year", unit, endFormat: fmt, hoverDp: 2, nameOnEnd: false }),
      `${fy ? "Financial" : "Calendar"} years, ${p.rows[0].date.slice(0, 4)} to ${p.rows.at(-1).date.slice(0, 4)}.`);
  }
  if (p.id === "flow-bridge") {
    // from primary supply to the energy users receive: a waterfall where it has room, ranked steps on a phone
    const steps = p.rows.slice(0, -1).map((r) => [r.name, r.value]), total = p.rows.at(-1);
    const sum = steps.reduce((a, [, v]) => a + v, 0);
    if (Math.abs(sum - total.value) > 0.01) throw Error(`energy flow-bridge: steps add to ${sum}, not ${total.value}`);
    return fig((width) => width >= 1000
      ? K.waterfall({ width, rows: steps, total: [total.name, total.value], unit, fmt: (v) => energyFormat(v, "mtoe").replace(" Mtoe", "") })
      : barsDraw(p.rows.map((r, i) => ({ ...r, highlight: i === 0 || i === p.rows.length - 1 })), { sort: false, fmt, unit })(width),
    "Million tonnes of oil equivalent: primary supply, each step that adds or takes away, and the energy that reaches users.");
  }
  // bar labels carry the number; the unit sits on the scale and in the plate's sub
  const bare = (v) => p.unit === "pct" ? fmt(v) : fmt(v).replace(" " + energyUnitLabel(p.unit), "");
  const top = Math.max(...p.rows.map((r) => r.value ?? -Infinity));
  // the largest row names the unit once, beside its value (a phone draws no scale)
  const rows = p.rows.map((r) => ({ ...r, highlight: !p.id.startsWith("states-") && r.value === top, note: p.unit !== "pct" && r.value === top ? energyUnitLabel(p.unit) : undefined }));
  return fig(barsDraw(rows, { fmt: bare, unit }), "Ranked, latest year.");
}

export function energyNumbers(model) {
  const N = {};
  for (const [id, f] of Object.entries(model.facts)) N["n-" + id] = energyFormat(f.value, f.unit);
  for (const p of model.plates) { const r = p.kind === "history" ? p.rows.filter((r) => r.value != null).at(-1) : p.rows[0]; N["pv-" + p.id] = energyFormat(r.value, p.unit); }
  return N;
}
