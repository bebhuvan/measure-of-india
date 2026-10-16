// Climate guide: the plates, drawn at build time with the chart kit (src/kit/). Each export takes
// the page's derived numbers (climateData() in src/dossiers/climate.data.js, already rounded where
// the copy quotes them) and returns a bare figure for a plate's .plotzone; the plate's title,
// source line and buttons stay in src/pages/guides/climate.astro.
// Three instruments (station record, reanalysis, model projections) are drawn apart, never
// joined; projections are dashed or drawn as ranges.
import * as K from "../kit/kit.js";
import { figure } from "../kit/figure.js";

const C_ = K.C;
const sgn = (v, dp = 1) => K.num(v, { dp, sign: true });
const n0 = (v) => K.num(v, { dp: 0 });
const yrs = (arr) => arr.map(([y, v]) => [String(y), v]);
const SSP = { ssp126: "SSP1-2.6", ssp245: "SSP2-4.5", ssp370: "SSP3-7.0", ssp585: "SSP5-8.5" };
const wl = (y) => `${y}-${String(y + 19).slice(2)}`;
const win = (p) => `${p[0]}-${Math.floor(p[0] / 100) === Math.floor(p[1] / 100) ? String(p[1]).slice(2) : p[1]}`;
const shortName = (n) => n.replace("Andaman and Nicobar Islands", "Andaman and Nicobar");
const MONTHS = { Jan: "January", Feb: "February", Mar: "March", Apr: "April", May: "May", Jun: "June", Jul: "July", Aug: "August", Sep: "September", Oct: "October", Nov: "November", Dec: "December" };
const file = (f) => "india-atlas_climate-" + f;
// a flat line at a period's average, across the years a panel draws
const flat = (data, v) => [[data[0][0], v], [data.at(-1)[0], v]];

/** The stripes: every month since 1940 against the same month's 1991-2020 average. */
export function stripes(C) {
  const y0 = C.stripes[0][0], y1 = C.stripes.at(-1)[0], years = [];
  for (let y = y0; y <= y1; y++) years.push(y);
  const at = new Map(C.stripes.map(([y, m, v]) => [`${y}-${m}`, v]));
  const rows = Object.keys(MONTHS).map((m, i) => ({ name: m, cells: years.map((y) => at.get(`${y}-${i + 1}`) ?? null) }));
  return figure({
    bare: true, file: file("monthly-anomaly"),
    label: `India's average temperature in every month from January 1940 to ${MONTHS[Object.keys(MONTHS)[C.stripes.at(-1)[1] - 1]]} ${y1}, against the 1991-2020 average for that month: blue colder, red warmer`,
    data: { cols: ["year", "month", "anomaly_c_vs_1991_2020"], rows: C.stripes },
    draw: (width) => K.heatmap({
      width, rows, cols: years.map(String), mid: 0, span: 2, sign: true, dp: 2, unit: { suffix: "°C" }, values: false,
      legend: ["−2°C or colder", "+2°C or warmer"],
      colShow: (j, phone) => years[j] % (phone ? 20 : 10) === 0,
    }),
  });
}

// several yearly counts, each on its own scale, each with its baseline average as a grey line
function yearPanels(list, { csvName, label, short }) {
  const panels = (phone) => list.map((p) => {
    const data = yrs(p.data);
    return { name: phone ? short[p.k] : p.label, sub: `${win([1951, 1980])} average ${K.num(p.base, { dp: 1 })}`, lines: [{ data: flat(data, Math.round(p.base * 10) / 10), role: "ctx2" }, { data, role: "lead" }] };
  });
  return figure({
    bare: true, file: file(csvName), label,
    data: { cols: ["year", ...list.map((p) => p.k)], rows: list[0].data.map(([y]) => [y, ...list.map((p) => p.data.find((d) => d[0] === y)?.[1] ?? null)]) },
    draw: (width) => K.multiples({ width, panels: panels(width < 520), shared: false, cols: width > 1000 ? 4 : 2, tFmt: (d) => d }),
  });
}

/** Hot days, warm nights and humid heat, India, 1950 onward. */
export const heat = (C) => yearPanels(C.heat, { csvName: "heat-days",
  short: { hd40: "Days of 40°C", tr26: "Nights of 26°C", wbt27: "Wet-bulb 27°C days", hi41: "Heat index 41°C days" },
  label: "Four counts of days a year at an average spot in India since 1950, each with its 1951-1980 average as a grey line: days of 40°C, nights of 26°C, wet-bulb days of 27°C and heat-index days of 41°C" });

/** Rain extremes, four measures, four scales. */
export const rainExtremes = (C) => yearPanels(C.rain.extremes, { csvName: "rain-extremes",
  short: { rx5day: "Wettest five days, mm", r99ptot: "Wettest 1% of days, %", r50mm: "Days of 50 mm+", cdd: "Longest dry spell, days" },
  label: "Four measures of how rain falls over India since 1950, each with its 1951-1980 average as a grey line: the wettest five days, the share falling on the wettest 1% of days, days of 50 mm or more, and the longest dry spell" });

/** A century of warming: the station record and the reanalysis, each against its own 1951-1980 mean. */
export function century(C) {
  return figure({
    bare: true, file: file("century"),
    label: `India's annual mean temperature against 1951-1980: the station record from 1901 to ${C.century.cruLast} as the lead line, the reanalysis from 1950 as a grey line, never joined`,
    data: { cols: ["year", "cru_ts_c_vs_1951_1980", "era5_c_vs_1951_1980"], rows: C.century.cru.map(([y, v]) => [y, v, C.century.era5.find((e) => e[0] === y)?.[1] ?? null]) },
    draw: (width) => K.line({
      width, freq: "year", unit: { suffix: "°C" }, hoverDp: 2, endFormat: (v) => sgn(v) + "°C",
      series: [
        { name: "Reanalysis (ERA5)", short: "Reanalysis", data: yrs(C.century.era5), role: "ctx" },
        { name: "Station record (CRU TS)", short: "Stations", data: yrs(C.century.cru), role: "lead" },
      ],
      events: [{ t: "1950", label: "Reanalysis begins, 1950", short: "Reanalysis from 1950" }],
    }),
  });
}

/** Months: change in day and night temperature. */
export function months(C) {
  const top = [...C.months].sort((a, b) => b.tas - a.tas)[0].m;
  return figure({
    bare: true, file: file("months-day-night"),
    label: "Change in the average daily maximum and daily minimum temperature for each calendar month, 1951-1980 to 1996-2025: nights warmed more than days in most months",
    data: { cols: ["month", "change_tmax_c", "change_tmin_c", "change_tmean_c"], rows: C.months.map((r) => [r.m, r.tmax, r.tmin, r.tas]) },
    draw: (width) => K.dumbbell({
      width, sortBy: "none", labelAll: true, aColor: C_.ink2, unit: { suffix: "°C" }, fmt: (v) => sgn(v),
      keys: { a: "Days (daily maximum)", b: "Nights (daily minimum)" },
      rows: C.months.map((r) => ({ name: MONTHS[r.m], a: r.tmax, b: r.tmin, highlight: r.m === top })),
    }),
  });
}

/** States: warming by the station record and the reanalysis. */
export function states(C) {
  return figure({
    bare: true, file: file("states-warming"),
    label: "Change in annual mean temperature by state, 1951-1980 to 1996-2025, the station record as a filled dot and the reanalysis as a hollow one, sorted by the station record",
    data: { cols: ["state", "change_cru_c", "change_era5_c", "change_era5_tmax_c", "change_era5_tmin_c"], rows: [...C.states].sort((p, q) => q.tasCru - p.tasCru).map((r) => [r.name, r.tasCru, r.tas, r.tmax, r.tmin]) },
    draw: (width) => K.dumbbell({
      width, sortBy: "b", labelAll: true, aColor: C_.ink2, unit: { suffix: "°C" }, fmt: (v) => sgn(v),
      keys: { a: "Reanalysis (ERA5)", b: "Station record (CRU TS)" },
      rows: C.states.map((s) => ({ name: shortName(s.name), a: s.tas, b: s.tasCru, highlight: s.k === "delhi" })),
    }),
  });
}

/** States: change in humid days and in 40°C days. */
export function statesHumid(C) {
  return figure({
    bare: true, file: file("states-humid-heat"),
    label: "Change in days a year with a wet-bulb temperature of 27°C or more, and in days of 40°C or more, by state, 1951-1980 to 1996-2025, sorted by the humid days",
    data: { cols: ["state", "change_wbt27_days", "change_hd40_days", "wbt27_days_1996_2025", "hd40_days_1996_2025"], rows: [...C.states].sort((p, q) => q.wbt27 - p.wbt27).map((r) => [r.name, r.wbt27, r.hd40, r.wbt27now, r.hd40now]) },
    draw: (width) => K.dumbbell({
      width, sortBy: "b", labelAll: true, aColor: C_.ink2, unit: { suffix: " days" }, fmt: (v) => sgn(v),
      keys: { a: "Days of 40°C or more", b: "Wet-bulb days, 27°C or more" },
      rows: C.states.map((s) => ({ name: shortName(s.name), a: s.hd40, b: s.wbt27 })),
    }),
  });
}

/** The monsoon: a century of annual rain, the dry years picked out. */
export function rain(C) {
  const R = C.rain, base = R.base;
  return figure({
    bare: true, file: file("annual-rainfall"),
    label: `India's annual rainfall from 1901 to ${R.annual.at(-1)[0]}, millimetres, with the 1951-1980 average of ${K.num(base, { dp: 0 })} mm as a dotted line; years at least 10% below it in blue`,
    data: { cols: ["year", "rain_mm", "june_to_september_share_pct"], rows: R.annual.map(([y, v]) => [y, v, R.jjasShare.find((j) => j[0] === y)?.[1] ?? null]) },
    draw: (width) => K.columns({
      width, freq: "year", data: yrs(R.annual), unit: { suffix: " mm" }, valueDp: 0, negColor: false,
      fillOf: (p) => (p.v < base * 0.9 ? C_.lead : C_.ctx2),
      ref: { y: base, label: `${win([1951, 1980])} average, ${K.num(base, { dp: 0 })} mm` },
    }),
  });
}

/** The monsoon: the shape of the season, month by month. */
export function rainMonths(C) {
  return figure({
    bare: true, file: file("rain-by-month"),
    label: "Average rainfall in each month, 1951-1980 against 1996-2025, millimetres: June a little drier, September a little wetter",
    data: { cols: ["month", "rain_mm_1951_1980", "rain_mm_1996_2025"], rows: C.rain.months.map((r) => [r.m, r.base, r.recent]) },
    draw: (width) => K.dumbbell({
      width, sortBy: "none", labelAll: true, aColor: C_.ink2, unit: { suffix: " mm" }, fmt: n0,
      keys: { a: win(C.WIN.base), b: win(C.WIN.recent) },
      rows: C.rain.months.map((r) => ({ name: MONTHS[r.m], a: r.base, b: r.recent })),
    }),
  });
}

// lines with end labels; the CSV is the series table
function lines(series, { label, csv, unit, endDp = 0 }) {
  return figure({
    bare: true, file: file(csv), label,
    draw: (width) => K.line({ width, freq: "year", unit: { suffix: unit }, endDp, hoverDp: endDp, series }),
  });
}

export function co2(C) {
  const T = C.em.total;
  return lines([
    { name: "United States", data: yrs(T.USA), role: "ctx" },
    { name: "China", data: yrs(T.CHN), role: "comp" },
    { name: "India", data: yrs(T.IND), role: "lead" },
  ], { csv: "co2-total", unit: " Mt", label: `Carbon dioxide from fossil fuels and industry, million tonnes a year, 1950 to ${C.em.year}: India rising, third behind China and the United States` });
}

export function percap(C) {
  const P = C.em.pc;
  return lines([
    { name: "United States", data: yrs(P.USA), role: "ctx" },
    { name: "China", data: yrs(P.CHN), role: "ctx2" },
    { name: "World", data: yrs(P.WLD), role: "comp" },
    { name: "India", data: yrs(P.IND), role: "lead" },
  ], { csv: "co2-per-person", unit: " t", endDp: 1, label: `Carbon dioxide per person, tonnes a year, 1950 to ${C.em.year}: India below half the world average` });
}

export function fuels(C) {
  const L = { coal_co2: ["Coal", "lead"], oil_co2: ["Oil", "ctx"], cement_co2: ["Cement", "ctx2"], gas_co2: ["Gas", "ctx2"], flaring_co2: ["Flaring", "ctx2"] };
  return lines(C.em.fuels.map((f) => ({ name: L[f.k][0], data: yrs(f.data), role: L[f.k][1] })),
    { csv: "india-co2-by-fuel", unit: " Mt", label: `India's carbon dioxide by source, million tonnes a year, 1950 to ${C.em.year}: coal far above oil, cement, gas and flaring` });
}

export function gases(C) {
  const L = { co2_including_luc: ["Carbon dioxide", "lead"], methane: ["Methane", "comp"], nitrous_oxide: ["Nitrous oxide", "ctx"] };
  return lines(C.em.gases.map((g) => ({ name: L[g.k][0], data: yrs(g.data), role: L[g.k][1] })),
    { csv: "india-ghg-by-gas", unit: " Mt", label: `India's greenhouse gas emissions by gas, million tonnes of CO₂-equivalent a year, 1950 to ${C.em.year}` });
}

/** Shares of annual CO₂, of all CO₂ since 1750, and of warming caused. */
export function stock(C) {
  const E = C.em, N = { IND: "India", CHN: "China", USA: "United States" };
  const M = [["annual", `CO₂ in ${E.year}`], ["cumulative", "all CO₂ since 1750"], ["warming", "warming caused"]];
  const rows = Object.entries(N).flatMap(([g, n]) => M.map(([k, lab]) => ({ name: `${n}: ${lab}`, value: Math.round(E.share[g][k] * 10) / 10, highlight: g === "IND" })));
  return figure({
    bare: true, file: file("shares-of-emissions-and-warming"),
    label: `Shares of the world's annual CO₂ in ${E.year}, of all CO₂ since 1750 and of the warming caused so far, for India, China and the United States`,
    data: { cols: ["country", "share_annual_co2_pct", "share_cumulative_co2_pct", "share_of_warming_pct"], rows: Object.entries(N).map(([g, n]) => [n, E.share[g].annual, E.share[g].cumulative, E.share[g].warming]) },
    draw: (width) => K.bars({ width, rows, sort: false, unit: { suffix: "%" }, dp: 1 }),
  });
}

const NAMES = { coal: "Coal", oil: "Oil", gas: "Gas", nuclear: "Nuclear", hydro: "Hydro", solar: "Solar", wind: "Wind", biofuel: "Biofuels", other_renewables: "Other renewables" };
// sources under 2% sit in the CSV download, not on the chart (the plate's source line says so)
function mix(rows, roles, { csv, label }) {
  const shown = rows.filter((r) => r.last != null && r.last >= 2);
  return figure({
    bare: true, file: file(csv), label,
    data: { cols: ["year", ...rows.map((r) => r.f + "_pct")], rows: rows[0].data.map(([y]) => [y, ...rows.map((r) => r.data.find((d) => d[0] === y)?.[1] ?? null)]) },
    draw: (width) => K.line({ width, freq: "year", unit: { suffix: "%" }, endDp: 1, hoverDp: 1,
      series: shown.map((r) => ({ name: NAMES[r.f], data: yrs(r.data), role: roles[r.f] ?? "ctx2" })) }),
  });
}
export const energy = (C) => mix(C.energy.primary, { coal: "lead", oil: "ctx" }, { csv: "india-primary-energy-mix",
  label: `Shares of India's primary energy by source, 1965 to ${C.energy.year}: coal above half, then oil` });
export const power = (C) => mix(C.energy.elec, { solar: "lead", wind: "comp", coal: "ctx" }, { csv: "india-electricity-mix",
  label: `Shares of India's electricity generation by source, 1985 to ${C.energy.elYear}: coal still the bulk, solar and wind rising from nothing` });

/** Projected warming by window and scenario: the median of the models and their 10th to 90th percentile range. */
export function proj(C) {
  const P = C.proj, last = P.windows.at(-1);
  const rows = P.windows.flatMap((y) => P.tas.map((s) => { const w = s.w.find((x) => x.y === y); return { name: `${wl(y)}, ${SSP[s.s]}`, a: w.p10, b: w.p90, m: w.med, highlight: y === last }; }));
  return figure({
    bare: true, file: file("projected-warming"),
    label: "Projected change in India's annual mean temperature from 1995-2014, for four 20-year windows and four emission pathways: the models' median as a dot, their 10th to 90th percentile as a bar",
    data: { cols: ["scenario", "window", "median_c", "p10_c", "p90_c"], rows: P.tas.flatMap((s) => s.w.map((w) => [SSP[s.s], wl(w.y), w.med, w.p10, w.p90])) },
    draw: (width) => K.dumbbell({ width, rows, sortBy: "none", mid: true, unit: { suffix: "°C" }, fmt: (v) => sgn(v),
      keys: { a: "10th to 90th percentile of the models", b: "Median" } }),
  });
}

/** Projected hot days and nights: SSP2-4.5 and SSP5-8.5 by window, against the models' own 1995-2014 level. */
export function projHeat(C) {
  const P = C.proj, wy = (y) => String(y);
  const panels = P.days.map((d) => {
    const s = (k) => d.s.find((x) => x.s === k).w.map((w) => [wy(w.y), w.med]);
    const hi = s("ssp585").at(-1)[1];
    return { name: d.label, sub: `SSP5-8.5 ${K.num(hi, { dp: 1 })}; 1995-2014 ${K.num(d.ref, { dp: 1 })}`,
      lines: [{ data: [[wy(P.windows[0]), d.ref], [wy(P.windows.at(-1)), d.ref]], role: "ctx2" }, { data: s("ssp585"), role: "comp" }, { data: s("ssp245"), role: "lead" }] };
  });
  return figure({
    bare: true, file: file("projected-heat-days"),
    label: "Projected days a year at an average spot in India by 20-year window, under SSP2-4.5 and SSP5-8.5, ensemble median, against the models' own 1995-2014 level: nights of 26°C, days of 40°C and heat-index days of 41°C",
    data: { cols: ["index", "scenario", "window", "days_median"], rows: P.days.flatMap((d) => [[d.k, "1995-2014 (model)", "1995-2014", d.ref], ...d.s.flatMap((s) => s.w.map((w) => [d.k, SSP[s.s], wl(w.y), w.med]))]) },
    draw: (width) => K.multiples({ width, panels, shared: false, cols: width > 1000 ? 3 : width > 600 ? 3 : 1, tFmt: (d) => wl(+d),
      key: [{ name: "SSP2-4.5", role: "lead" }, { name: "SSP5-8.5", role: "comp" }, { name: "Models' 1995-2014 level", role: "ctx2" }] }),
  });
}

/** Projected warming by state, 2040-2059, SSP2-4.5, against India's own projected change. */
export function projStates(C) {
  const rows = C.states.filter((s) => s.proj != null);
  const india = C.proj.tas.find((x) => x.s === "ssp245").w.find((x) => x.y === 2040).med;
  return figure({
    bare: true, file: file("projected-warming-by-state"),
    label: "Projected change in annual mean temperature from 1995-2014 to 2040-2059 under SSP2-4.5, ensemble median, by state, against India's own projected change",
    data: { cols: ["state", "change_2040_2059_ssp245_median_c", "change_2080_2099_ssp585_median_c"], rows: [...rows].sort((p, q) => q.proj - p.proj).map((r) => [r.name, r.proj, r.proj85]) },
    draw: (width) => K.bars({ width, rows: rows.map((s) => ({ name: shortName(s.name), value: s.proj })), sign: true, dp: 1, unit: { suffix: "°C" },
      ref: { value: india, label: `India ${sgn(india)}°C` } }),
  });
}

/** Cooling degree days: observed, and projected by window, never joined. */
export function cool(C) {
  const P = C.proj, obs = yrs(C.cost.cdd), lastObs = obs.at(-1);
  const proj = (k) => P.cdd65.s.find((s) => s.s === k).w.map((w) => [String(w.y + 10), Math.round(w.med)]);
  return figure({
    bare: true, file: file("cooling-degree-days"),
    label: `Cooling degree days at an average spot in India: observed by the reanalysis from 1950 to ${lastObs[0]}, and projected by the models' median for 20-year windows to 2080-2099 under SSP2-4.5 and SSP5-8.5, drawn apart`,
    data: { cols: ["year_or_window", "instrument", "cooling_degree_days_f"], rows: [...C.cost.cdd.map(([y, v]) => [y, "ERA5 observed", v]), ["1995-2014", "CMIP6 median, historical", P.cdd65.ref], ...P.cdd65.s.flatMap((s) => s.w.map((w) => [`${w.y}-${w.y + 19}`, `CMIP6 median, ${SSP[s.s]}`, w.med]))] },
    draw: (width) => K.line({
      width, freq: "year", unit: {}, endDp: 0, hoverDp: 0,
      series: [
        { name: "Observed (ERA5)", data: obs, role: "lead", label: false },
        { name: "Projected, SSP2-4.5", short: "SSP2-4.5", data: proj("ssp245"), role: "ctx", dash: "4 3" },
        { name: "Projected, SSP5-8.5", short: "SSP5-8.5", data: proj("ssp585"), role: "comp", dash: "4 3" },
      ],
      seam: { t: "2026", before: "Observed", after: "Projected" },
      // the models' own 1995-2014 level as a ringed point; a phone has no room left of it, so it keeps the observed note only
      notes: [
        ...(width < 520 ? [] : [{ d: "2005", v: Math.round(P.cdd65.ref), text: `Models, 1995-2014\n${n0(P.cdd65.ref)}`, side: "left", below: true }]),
        { d: lastObs[0], v: lastObs[1], text: `Observed, ${lastObs[0]}\n${n0(lastObs[1])}`, below: true },
      ],
    }),
  });
}

/** Heat deaths: projected change in the death rate, RCP4.5. */
export function deaths(C) {
  const rows = C.cost.heatDeaths;
  return figure({
    bare: true, file: file("projected-heat-deaths"),
    label: "Projected change in India's death rate from non-optimal temperatures under RCP4.5, deaths per 100,000 people a year, against today",
    data: { cols: ["year", "change_deaths_per_100k_rcp45"], rows },
    draw: (width) => K.bars({ width, sort: false, sign: true, dp: 1, rows: rows.map(([y, v], i) => ({ name: String(y), value: v, highlight: i === rows.length - 1 })) }),
  });
}

/** Fires: area burnt by land type. */
export function fires(C) {
  const L = { croplands: ["Croplands", "lead"], forest: ["Forests", "ctx"], savannas: ["Savannas", "ctx2"], shrublands_grasslands: ["Shrubland and grassland", "ctx2"], other: ["Other land", "ctx2"] };
  return figure({
    bare: true, file: file("burnt-area-by-land-type"),
    label: `Area burnt in India by land type, lakh hectares a year, 2002 to ${C.cost.firesAll.at(-1)[0]}: croplands far above forests, savannas and grassland`,
    data: { cols: ["year", ...C.cost.fires.map((f) => f.k + "_ha")], rows: C.cost.firesAll.map(([y]) => [y, ...C.cost.fires.map((f) => f.data.find((d) => d[0] === y)?.[1] ?? null)]) },
    draw: (width) => K.line({ width, freq: "year", unit: { suffix: " lakh ha" }, endDp: 1, hoverDp: 1,
      series: C.cost.fires.filter((f) => L[f.k]).map((f) => ({ name: L[f.k][0], data: f.data.map(([y, v]) => [String(y), Math.round(v / 1e4) / 10]), role: L[f.k][1] })) }),
  });
}
