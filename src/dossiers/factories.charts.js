// Enterprises guide (ASI factories and ASUSE establishments): the plates, drawn at build time with
// the chart kit (src/kit/), and the page's numbers, computed from the same bundles. Each plate
// export returns a bare figure for its .plotzone; titles, source lines and buttons stay in
// src/pages/guides/factories.astro. Two surveys share the page and are never conflated: the ASI
// (registered factories) and ASUSE (unincorporated establishments). ASI money arrives in ₹ lakh
// and is shown in ₹ lakh crore, always nominal; the four ASI classification blocks are four
// separate series, never joined.
import * as K from "../kit/kit.js";
import { figure } from "../kit/figure.js";
import { roundRates, numWord } from "./precision.js";
import headlineRaw from "../../data/series/asi-headline.json";
import accountsRaw from "../../data/series/asi-accounts.json";
import l87Raw from "../../data/series/asi-headline-1987.json";
import l98Raw from "../../data/series/asi-headline-1998.json";
import l04Raw from "../../data/series/asi-headline-2004.json";
import industriesRaw from "../../data/series/asi-industries.json";
import statesRaw from "../../data/series/asi-states.json";
import asuseRaw from "../../data/series/asuse-annual.json";
import asuseQRaw from "../../data/series/asuse-quarterly.json";
import asuseSecRaw from "../../data/series/asuse-sectors.json";
import asuseStRaw from "../../data/series/asuse-states.json";
import ownersRaw from "../../data/series/asuse-owners.json";
import modernityRaw from "../../data/series/asuse-modernity.json";
import structureRaw from "../../data/series/asuse-structure.json";

// rates at the precision the agency publishes, rounded once (src/dossiers/precision.js)
const [headlineB, accountsB, l87B, l98B, l04B, industriesB, statesB, asuseB, asuseQB, asuseSecB, asuseStB, ownersB, modernityB, structureB] =
  [headlineRaw, accountsRaw, l87Raw, l98Raw, l04Raw, industriesRaw, statesRaw, asuseRaw, asuseQRaw, asuseSecRaw, asuseStRaw, ownersRaw, modernityRaw, structureRaw].map((b) => roundRates(b));

/* ---------- bundles as {key: {label, data:[{date, value}]}}, dates as Date (UTC) ---------- */
function hydrate(b) {
  const dates = b.dates.map((d) => new Date(d + "T00:00:00Z")), S = {};
  for (const [k, s] of Object.entries(b.series)) S[k] = { label: s.label, data: s.data.map((v, i) => ({ date: dates[i], value: v ?? null })) };
  return S;
}
const H = hydrate(headlineB), ACC = hydrate(accountsB), L87 = hydrate(l87B), L98 = hydrate(l98B), L04 = hydrate(l04B);
const UA = hydrate(asuseB), UQ = hydrate(asuseQB), USec = hydrate(asuseSecB), USt = hydrate(asuseStB);
const UO = hydrate(ownersB), UM = hydrate(modernityB), US = hydrate(structureB);

/* ---------- formatters (the client's, unchanged) ---------- */
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;");
const pc = (u) => `<span class="pc">${u}</span>`;
const fmtIN = (n) => K.inGroup(Math.round(n)).replace("−", "-"); // en-IN grouping, as toLocaleString wrote it
const fy = (d) => d.getUTCFullYear() + "-" + String((d.getUTCFullYear() + 1) % 100).padStart(2, "0");
const fyS = (s) => fy(new Date(s + "T00:00:00Z"));
const croreN = (n, dp = 2) => (n / 1e7).toFixed(dp);
const lakhOf = (n, dp = 1) => (n / 1e5).toFixed(dp);
const lakhCr = (vLakh, dp = 1) => "₹" + (vLakh / 1e7).toFixed(dp) + " lakh cr";
const last = (s) => s.data.filter((d) => d.value != null).at(-1).value;
const prevV = (s) => s.data.filter((d) => d.value != null).at(-2).value;
const firstV = (s) => s.data.filter((d) => d.value != null)[0].value;
const arrow = (d, f) => (d >= 0 ? "▲ +" : "▼ −") + f(Math.abs(d));
const PCT = { suffix: "%" };

/** kit pairs [[date, value]] from a hydrated series, scaled for display (never in the data). */
const kp = (s, scale = 1) => s.data.map((d) => [d.date.toISOString().slice(0, 10), d.value == null ? null : d.value * scale]);
/** several drawings stacked in one plate, each under a small head: different units never share
 * an axis. Only the first keeps the hover readout: a figure's hover belongs to one chart. */
const quiet = (svg) => svg.replace(/ data-ak='[^']*'/, "").replace(/ class="ak-hit"/, "");
const stack = (parts) => parts.map((p, i) => `<div class="fx-cell"><p class="fx-ph"><b>${esc(p.name)}</b>${p.sub ? ` <span>${esc(p.sub)}</span>` : ""}</p>${i ? quiet(p.svg) : p.svg}</div>`).join("");
const csvOf = (cols, rows) => ({ cols, rows });
/** a long name cut at a word to fit a bar chart's name column on a desktop (the kit's column is
 * at most 200 px at 13 px); a phone sets names above the bars, at full width */
const fit = (name, width, px = 186) => {
  if (width < 560 || K.tw(name, 13) <= px) return name;
  let t = name; while (t.length > 4 && K.tw(t + "…", 13) > px) t = t.slice(0, -1).replace(/[ ,]+\S*$/, (m) => (m.trim() ? m : ""));
  return t.replace(/[ ,;:&-]+$/, "") + "…";
};

/* derived signature numbers (both surveys, same year, nominal) */
const gvaPerPersonASI = (last(H.gva) * 1e5) / last(H.persons_engaged);
const emolPerPersonASI = (last(H.emoluments) * 1e5) / last(H.persons_engaged);
const multAll = gvaPerPersonASI / last(UA.gva_per_worker_all);
const multOAE = gvaPerPersonASI / last(UA.gva_per_worker_oae);
const wageMult = emolPerPersonASI / last(UA.emoluments_per_hired_worker_hwe);

/* ---------- §03 plate 1: the long century, four rulers never joined ---------- */
const BLOCKS = [["NIC-1987", L87, "ctx2"], ["NIC-1998", L98, "ctx"], ["NIC-2004", L04, "ctx2"], ["NIC-2008", H, "lead"]];
export function long() {
  const lineOf = (key, scale, unitLab, endF, width, events) => K.line({
    width, freq: "fy", unit: { suffix: unitLab }, endFormat: endF, hoverDp: 2, height: width < 520 ? 220 : 300,
    series: BLOCKS.map(([lab, S, role]) => ({ name: lab, short: lab, data: kp(S[key], scale), role, label: role === "lead" })),
    events,
  });
  const ev = [["1998-04-01", "NIC-1998"], ["2004-04-01", "NIC-2004"], ["2008-04-01", "NIC-2008"]].map(([t, l]) => ({ t, label: `${l} begins`, short: l.slice(4) }));
  const csvYears = []; for (let y = 1992; y <= 2023; y++) csvYears.push(y);
  const at = (S, key, y) => S[key].data.find((d) => d.date.getUTCFullYear() === y)?.value ?? null;
  return figure({
    bare: true, file: "india-atlas_asi_four-blocks_1992-2023",
    label: `Factories on the ASI register and persons engaged, 1992-93 to 2023-24, four classification blocks drawn as separate lines that never join; the register stood at ${fmtIN(firstV(L87.number_of_factories))} in 1992-93 and ${fmtIN(last(H.number_of_factories))} in 2023-24`,
    data: csvOf(["fiscal_year", ...BLOCKS.flatMap(([lab]) => [`factories_${lab.toLowerCase().replace("-", "")}`, `persons_${lab.toLowerCase().replace("-", "")}`])],
      csvYears.map((y) => [`${y}-${String((y + 1) % 100).padStart(2, "0")}`, ...BLOCKS.flatMap(([, S]) => [at(S, "number_of_factories", y), at(S, "persons_engaged", y)])])),
    draw: (width) => stack([
      { name: "Factories on the register", sub: "lakh", svg: lineOf("number_of_factories", 1e-5, " lakh", (v) => v.toFixed(2) + " lakh", width, ev) },
      { name: "Persons engaged", sub: "crore", svg: lineOf("persons_engaged", 1e-7, " cr", (v) => v.toFixed(2) + " cr", width, []) },
    ]),
  });
}

/* ---------- §03: the counts, two panels ---------- */
export function count() {
  const w2 = (width, series, unit, endF, events) => K.line({ width, freq: "fy", unit, endFormat: endF, hoverDp: 2, height: width < 520 ? 220 : 300, series, events });
  return figure({
    bare: true, file: "india-atlas_asi_factory-counts_2008-2023",
    label: `Registered factories and factories in operation, persons engaged and workers, 2008-09 to 2023-24: factories in operation rise from ${fmtIN(firstV(H.factories_in_operation))} to ${fmtIN(last(H.factories_in_operation))}; the 2010-11 step is a revised sampling frame, not growth`,
    data: csvOf(["fiscal_year", "number_of_factories", "factories_in_operation", "persons_engaged", "workers"],
      H.gva.data.map((d, i) => [fy(d.date), H.number_of_factories.data[i].value, H.factories_in_operation.data[i].value, H.persons_engaged.data[i].value, H.workers.data[i].value])),
    draw: (width) => stack([
      { name: "Factories", sub: "lakh", svg: w2(width, [
        // a phone's end label keeps one word: "Register" and "Operating" say it alone
        { name: "On the register", short: width < 520 ? "Register" : "On the register", data: kp(H.number_of_factories, 1e-5), role: "ctx" },
        { name: "In operation", short: width < 520 ? "Operating" : "In operation", data: kp(H.factories_in_operation, 1e-5), role: "lead" },
      ], { suffix: " lakh" }, (v) => v.toFixed(2) + " lakh", [{ t: "2010-04-01", label: "2010-11, frame revised: a wider net, not new factories", short: "Frame revised" }]) },
      { name: "People", sub: "crore", svg: w2(width, [
        { name: "Workers", short: "Workers", data: kp(H.workers, 1e-7), role: "ctx" },
        { name: "Persons engaged", short: "Persons engaged", data: kp(H.persons_engaged, 1e-7), role: "lead" },
      ], { suffix: " cr" }, (v) => v.toFixed(2) + " cr", []) },
    ]),
  });
}

/* ---------- §04: the money, and its derived y/y ---------- */
export function money() {
  const yoy = H.gva.data.map((d, i) => [d.date.toISOString().slice(0, 10), i === 0 ? null : Math.round((d.value / H.gva.data[i - 1].value - 1) * 1000) / 10]).slice(1);
  const pk = yoy.reduce((a, p) => (p[1] != null && (!a || p[1] > a[1]) ? p : a), null);
  return figure({
    bare: true, file: "india-atlas_asi_gva-emoluments_2008-2023",
    label: `Factory gross value added and emoluments, ₹ lakh crore, nominal, 2008-09 to 2023-24, with the year-on-year change in GVA derived from the levels: GVA ends at ₹${(last(H.gva) / 1e7).toFixed(1)} lakh crore, emoluments at ₹${(last(H.emoluments) / 1e7).toFixed(1)} lakh crore`,
    data: csvOf(["fiscal_year", "gva_inr_lakh_crore", "emoluments_inr_lakh_crore", "gva_yoy_pct_derived"],
      H.gva.data.map((d, i) => [fy(d.date), d.value / 1e7, H.emoluments.data[i].value / 1e7, i ? yoy[i - 1][1] : null])),
    draw: (width) => stack([
      { name: "GVA and emoluments", sub: "₹ lakh crore, nominal", svg: K.line({
        width, freq: "fy", unit: { prefix: "₹" }, endFormat: (v) => "₹" + v.toFixed(1), hoverDp: 1, height: width < 520 ? 240 : 320,
        series: [
          { name: "Emoluments", short: "Emoluments", data: kp(H.emoluments, 1e-7), role: "ctx" },
          { name: "GVA", short: "GVA", data: kp(H.gva, 1e-7), role: "lead" },
        ] }) },
      { name: "GVA, change on the year before", sub: "per cent, derived from the levels", svg: K.line({
        width, freq: "fy", unit: PCT, endDp: 1, hoverDp: 1, height: width < 520 ? 200 : 220,
        series: [{ name: "GVA y/y, derived", data: yoy, role: "lead", dash: "4 3" }],
        notes: [{ d: pk[0], v: pk[1], text: `${K.num(pk[1], { dp: 1, sign: true })}%, ${fyS(pk[0])}\nrebound plus reflation`, side: "left" }] }) },
    ]),
  });
}

/* ---------- §05: state shares of factory GVA ---------- */
function stateRows() {
  const rename = { "Dadra & Nagar Havelli and Daman & Diu": "DNH & Daman & Diu" };
  const rows = [];
  for (const [k, s] of Object.entries(statesB.series)) {
    if (!k.startsWith("gva_")) continue;
    const v = s.data.at(-1); if (v == null) continue; // pre-merger UTs with discontinued series
    const nm = s.label.split(" · ")[1];
    rows.push({ state: rename[nm] || nm, gva: v });
  }
  const total = rows.reduce((a, r) => a + r.gva, 0);
  rows.forEach((r) => (r.share = (r.gva / total) * 100));
  return rows.sort((a, b) => b.share - a.share);
}
export function states() {
  const rows = stateRows(), s3 = rows.slice(0, 3).reduce((a, r) => a + r.share, 0);
  return figure({
    bare: true, file: "india-atlas_asi_state-gva-shares_2023-24",
    label: `State shares of factory gross value added, 2023-24: ${rows.slice(0, 3).map((r) => `${r.state} ${r.share.toFixed(1)} per cent`).join(", ")}, together ${s3.toFixed(1)} per cent; ${rows.length} states and union territories`,
    data: csvOf(["state", "share_pct", "gva_inr_lakh"], rows.map((r) => [r.state, +r.share.toFixed(1), r.gva])),
    draw: (width) => K.bars({ width, unit: PCT, dp: 1, rows: rows.map((r, i) => ({ name: fit(r.state, width), value: +r.share.toFixed(1), highlight: i < 3 })) }),
  });
}

/* ---------- §06: industries ---------- */
const SHORT_IND = {
  "10": "Food products", "11": "Beverages", "12": "Tobacco", "13": "Textiles", "14": "Wearing apparel", "15": "Leather",
  "16": "Wood products", "17": "Paper", "18": "Printing", "19": "Coke & petroleum", "20": "Chemicals", "21": "Pharmaceuticals",
  "22": "Rubber & plastics", "23": "Non-metallic minerals", "24": "Basic metals", "25": "Fabricated metal", "26": "Electronics & optical",
  "27": "Electrical equipment", "28": "Machinery n.e.c.", "29": "Motor vehicles", "30": "Other transport eqpt", "31": "Furniture",
  "32": "Other manufacturing", "33": "Repair & installation", "38": "Waste & recovery", "58": "Publishing", "01": "Crop & animal services",
  "08": "Other mining", "99998": "Unclassified",
};
const SHORT_JV = {
  "10": "Food", "11": "Beverages", "12": "Tobacco", "13": "Textiles", "14": "Apparel", "15": "Leather", "16": "Wood", "17": "Paper", "18": "Printing",
  "19": "Coke & petroleum", "20": "Chemicals", "21": "Pharmaceuticals", "22": "Rubber & plastics", "23": "Non-metallic minerals", "24": "Basic metals",
  "25": "Fabricated metal", "26": "Electronics", "27": "Electrical eqpt", "28": "Machinery", "29": "Motor vehicles", "30": "Other transport", "31": "Furniture",
  "32": "Other mfg", "33": "Repair", "38": "Waste", "58": "Publishing", "01": "Crop services", "08": "Other mining",
};
const indCells = () => {
  const totalGVA = last(H.gva);
  return Object.entries(industriesB.series).filter(([k]) => k.startsWith("gva_")).map(([k, s]) => {
    const code = k.slice(4);
    return { code, name: SHORT_IND[code] || s.label, latest: s.data.at(-1), data: industriesB.dates.map((d, i) => [d, s.data[i] == null ? null : s.data[i] / 1e7]), sh: (s.data.at(-1) / totalGVA) * 100 };
  }).sort((a, b) => b.latest - a.latest);
};
export function industries() {
  const cells = indCells(), share5 = cells.slice(0, 5).reduce((a, c) => a + c.sh, 0);
  return figure({
    bare: true, file: "india-atlas_asi_gva-by-industry_2008-2023",
    label: `Small multiples of nominal factory GVA, 2008-09 to 2023-24, for ${cells.length} NIC divisions, each on its own scale, sorted by 2023-24 GVA: ${cells[0].name} leads at ${cells[0].sh.toFixed(1)} per cent of factory GVA; the five accented panels hold ${share5.toFixed(1)} per cent`,
    data: csvOf(["fiscal_year", ...cells.map((c) => "nic_" + c.code)], industriesB.dates.map((d, i) => [fyS(d), ...cells.map((c) => industriesB.series["gva_" + c.code].data[i])])),
    draw: (width) => K.multiples({
      width, shared: false, fy: true, cols: width < 520 ? 2 : width < 900 ? 3 : 5,
      panels: cells.map((c, i) => ({ name: c.code.length > 2 ? c.name : `${c.code}, ${c.name}`, data: c.data, highlight: i < 5,
        vText: c.sh.toFixed(1) + "%", sub: lakhCr(c.latest) })),
    }),
  });
}
function jvPoints() {
  const codes = [...new Set(Object.keys(industriesB.series).filter((k) => k.startsWith("gva_")).map((k) => k.slice(4)))].filter((c) => c !== "99998");
  const gv = (c) => industriesB.series["gva_" + c].data.at(-1), em = (c) => industriesB.series["persons_engaged_" + c]?.data.at(-1);
  const codes2 = codes.filter((c) => em(c) != null && gv(c) != null);
  const totG = codes2.reduce((a, c) => a + gv(c), 0), totE = codes2.reduce((a, c) => a + em(c), 0);
  const pts = codes2.map((c) => ({ code: c, name: SHORT_JV[c] || c, g: (gv(c) / totG) * 100, e: (em(c) / totE) * 100 })).filter((p) => p.g > 0.1 && p.e > 0.1);
  const labour = [...pts].sort((a, b) => b.e / b.g - a.e / a.g).slice(0, 4);
  const capTop = [...pts].sort((a, b) => b.g / b.e - a.g / a.e)[0];
  const labelled = new Set([...labour.map((p) => p.code), ...[...pts].sort((a, b) => b.g - a.g).slice(0, 3).map((p) => p.code), capTop.code]);
  return { pts, labour, capTop, labelled };
}
export function jobsValue() {
  const { pts, labour, capTop, labelled } = jvPoints();
  return figure({
    bare: true, file: "india-atlas_asi_jobs-vs-value_2023-24",
    label: `Share of factory employment against share of factory value added, by two-digit industry, 2023-24, one dot per industry; the most labour-intensive is ${labour[0].name} at ${labour[0].e.toFixed(1)} per cent of jobs against ${labour[0].g.toFixed(1)} per cent of value; the most capital-intensive is ${capTop.name}`,
    data: csvOf(["nic_code", "name", "employment_share_pct", "gva_share_pct"], pts.map((p) => [p.code, p.name, +p.e.toFixed(1), +p.g.toFixed(1)])),
    draw: (width) => K.scatter({
      width, xZero: true, medians: false, diag: { label: "equal shares" },
      xUnit: PCT, yUnit: PCT, xLabel: "share of factory employment", yLabel: "share of factory value added", xFmt: (v) => v + "%",
      points: pts.map((p) => ({ name: p.name, x: +p.e.toFixed(1), y: +p.g.toFixed(1), highlight: labour.includes(p), color: labour.includes(p) ? K.C.lead : K.C.ctx })),
      // a phone names the labour-intensive four and the most capital-intensive only
      label: pts.filter((p) => (width < 560 ? labour.includes(p) || p === capTop : labelled.has(p.code))).map((p) => p.name),
    }),
  });
}
function labRows() {
  const codes = Object.keys(industriesB.series).filter((k) => k.startsWith("persons_engaged_")).map((k) => k.slice(16)).filter((c) => c !== "99998");
  const totE = codes.reduce((a, c) => a + industriesB.series["persons_engaged_" + c].data.at(-1), 0);
  return codes.map((c) => ({ code: c, name: SHORT_IND[c] || c, emp: industriesB.series["persons_engaged_" + c].data.at(-1) }))
    .filter((d) => d.emp > 0).map((d) => ({ ...d, share: (d.emp / totE) * 100 })).sort((a, b) => b.share - a.share);
}
export function labour() {
  const rows = labRows();
  return figure({
    bare: true, file: "india-atlas_asi_employment-share-by-industry_2023-24",
    label: `Share of factory employment by two-digit industry, 2023-24: ${rows.slice(0, 3).map((r) => `${r.name} ${r.share.toFixed(1)} per cent`).join(", ")}`,
    data: csvOf(["nic_code", "name", "employment_share_pct", "persons_engaged_2023_24"], rows.map((r) => [r.code, r.name, +r.share.toFixed(1), r.emp])),
    draw: (width) => K.bars({ width, unit: PCT, dp: 1, rows: rows.map((r, i) => ({ name: fit(r.name, width), value: +r.share.toFixed(1), highlight: i < 3 })) }),
  });
}
/* what a factory job pays, and how big the plant is: derived from published series */
function wageSize() {
  const S = industriesB.series, i = industriesB.dates.length - 1;
  const codes = [...new Set(Object.keys(S).filter((k) => k.startsWith("persons_engaged_")).map((k) => k.slice(16)))].filter((c) => c !== "99998");
  const g = (k, c) => S[`${k}_${c}`]?.data[i];
  const rows = codes.map((c) => ({ c, name: SHORT_IND[c] || c, p: g("persons_engaged", c), wage: (g("emoluments", c) * 1e5) / g("persons_engaged", c), size: g("persons_engaged", c) / g("factories_in_operation", c) }))
    .filter((r) => Number.isFinite(r.wage) && Number.isFinite(r.size));
  const hi = H.persons_engaged.data.length - 1;
  const allWage = (H.emoluments.data[hi].value * 1e5) / H.persons_engaged.data[hi].value;
  const allSize = H.persons_engaged.data[hi].value / H.factories_in_operation.data[hi].value;
  return { rows, allWage, allSize, yr: fyS(industriesB.dates[i]) };
}
const wageF = (v) => (v >= 1e5 ? "₹" + (v / 1e5).toFixed(1) + "L" : "₹" + Math.round(v / 1000) + "k");
const wageL = (v) => wageF(v * 1e5); // the same label for a value held in ₹ lakh
export function wage() {
  const { rows, allWage, yr } = wageSize(), rs = [...rows].sort((a, b) => b.wage - a.wage);
  return figure({
    bare: true, file: "india-atlas_asi_emoluments-per-person_" + yr,
    label: `Total emoluments per person engaged by industry, ${yr}, from ${rs[0].name} at ${wageF(rs[0].wage)} to ${rs.at(-1).name} at ${wageF(rs.at(-1).wage)} a year; all factories ${wageF(allWage)}`,
    data: csvOf(["nic_code", "name", "wage_" + yr], rs.map((r) => [r.c, r.name, +r.wage.toFixed(1)])),
    draw: (width) => K.bars({ width, fmt: wageL, unit: { suffix: " lakh" }, rows: rs.map((r, i) => ({ name: r.name, value: r.wage / 1e5, highlight: i === 0 || i === rs.length - 1 })), ref: { value: allWage / 1e5, label: `All factories ${wageF(allWage)}` } }),
  });
}
export function size() {
  const { rows, allSize, yr } = wageSize(), rs = [...rows].sort((a, b) => b.size - a.size);
  const f = (v) => String(Math.round(v));
  return figure({
    bare: true, file: "india-atlas_asi_persons-per-factory_" + yr,
    label: `Persons engaged per factory in operation by industry, ${yr}, from ${rs[0].name} at ${f(rs[0].size)} to ${rs.at(-1).name} at ${f(rs.at(-1).size)}; all factories ${f(allSize)}`,
    data: csvOf(["nic_code", "name", "size_" + yr], rs.map((r) => [r.c, r.name, +r.size.toFixed(1)])),
    draw: (width) => K.bars({ width, fmt: f, rows: rs.map((r, i) => ({ name: r.name, value: r.size, highlight: i === 0 || i === rs.length - 1 })), ref: { value: allSize, label: `All factories ${f(allSize)}` } }),
  });
}

/* ---------- §08: inside the shelf (build-time picks made in the page's frontmatter) ---------- */
const shortClass = (t) => { const x = t.replace(/^(\d+) Manufacture of /, "$1 ").replace(/^(\d+) (.)/, (m, c, ch) => c + " " + ch.toUpperCase()); return x.length > 52 ? x.slice(0, 50).replace(/[ ,]+\S*$/, "") + "…" : x; };
export function nic4(A) {
  if (!A.topClasses.length) return "";
  const rows = A.topClasses.map((r) => ({ ...r, name: shortClass(r.name) }));
  const share = rows.reduce((a, r) => a + r.sh, 0), psh = rows.reduce((a, r) => a + (r.psh ?? 0), 0);
  return figure({
    bare: true, file: "india-atlas_asi_top-4-digit-classes",
    label: `The ${rows.length} largest 4-digit factory classes by share of value added, with each class's share of factory employment: ${rows.slice(0, 3).map((r) => `${r.name} ${r.sh.toFixed(1)} per cent`).join(", ")}; together ${share.toFixed(1)} per cent of value added and ${psh.toFixed(1)} per cent of jobs`,
    data: csvOf(["nic4", "class", "gva_share_pct", "employment_share_pct"], A.topClasses.map((r) => [r.code, r.name, +r.sh.toFixed(1), r.psh == null ? null : +r.psh.toFixed(1)])),
    draw: (width) => K.bars({ width, unit: PCT, dp: 1, sort: false, markFmt: (v) => "jobs " + v.toFixed(1) + "%",
      rows: rows.map((r, i) => ({ name: fit(r.name, width), value: +r.sh.toFixed(1), mark: r.psh == null ? null : +r.psh.toFixed(1), highlight: i === 0 })) }),
  });
}
const SHORTD = { "10": "Food products", "11": "Beverages", "13": "Textiles", "14": "Apparel", "19": "Refining", "20": "Chemicals", "21": "Pharmaceuticals",
  "22": "Rubber & plastics", "23": "Cement & glass", "24": "Basic metals", "25": "Fabricated metal", "26": "Electronics", "27": "Electrical equipment",
  "28": "Machinery", "29": "Motor vehicles", "30": "Other transport" };
const COLSHORT = { "Basic metals": "Metals", "Motor vehicles": "Vehicles", "Food products": "Food", "Pharmaceuticals": "Pharma", "Chemicals": "Chemicals",
  "Electrical equipment": "Electrical", "Fabricated metal": "Fab. metal", "Rubber & plastics": "Rubber", "Cement & glass": "Cement", "Other transport": "Transport", "All other": "Other" };
const mixCols = (A) => {
  const dn = (c) => { if (SHORTD[c]) return SHORTD[c]; const d = A.divs.find((x) => x.code === c); const n = d.name.replace(/^\d+ /, "").replace(/^Manufacture of /, ""); const s2 = n.split(/,| and /)[0]; return s2.charAt(0).toUpperCase() + s2.slice(1).toLowerCase(); };
  const cols = [...A.divs.map((d) => d.code), "other"];
  return { cols, colName: (c) => (c === "other" ? "All other" : dn(c)) };
};
export function stateMix(A) {
  if (!A.mix.length) return "";
  const { cols, colName } = mixCols(A);
  const rows = A.mix.map((m) => ({ name: m.state, cells: [...m.cells.map((c) => (c.sh == null ? null : +c.sh.toFixed(1))), +m.other.toFixed(1)] }));
  return figure({
    bare: true, file: "india-atlas_asi_state-by-division-mix",
    label: `Share of each state's factory value added by division, twelve states by the eight largest divisions and all other, ${A.fy}`,
    data: csvOf(["state", ...cols.map(colName)], rows.map((r) => [r.name, ...r.cells])),
    draw: (width) => K.heatmap({ width, unit: PCT, dp: 1, stagger: true, fill: (v) => K.C.seq[Math.min(5, Math.floor((v / 40) * 6))], colShow: () => true, cols: cols.map((c) => (width < 1000 ? COLSHORT[colName(c)] ?? colName(c) : colName(c))), rows }),
  });
}

/* ---------- §07: the 2025 round ---------- */
const lcT = (t) => { const x = t.replace(/^Manufacture of /, ""); return x.charAt(0) + x.slice(1).toLowerCase(); };
const shortT = (t) => { const x = lcT(t); return x.length > 44 ? x.slice(0, 42).replace(/[ ,]+\S*$/, "") + "…" : x; };
const lakhF = (v) => (v >= 1e5 ? (v / 1e5).toFixed(1) + " lakh" : fmtIN(v));
export function trades(U) {
  const rows = U.trades.map((r) => ({ ...r, name: shortT(r.a) }));
  return figure({
    bare: true, file: "india-atlas_asuse-2025_workers-by-activity",
    label: `Workers in unincorporated non-farm enterprises by activity, 2025, ${rows.length} activities: ${rows.slice(0, 3).map((r) => `${r.name} ${(r.n / 1e5).toFixed(1)} lakh`).join(", ")}`,
    data: csvOf(["activity", "workers_2025", "female_workers_2025"], rows.map((r) => [r.a, r.n, r.f])),
    draw: (width) => K.bars({ width, fmt: lakhF, rows: rows.map((r, i) => ({ name: fit(r.name, width), value: r.n, highlight: i === 0 })) }),
  });
}
export function women(U) {
  const all = (100 * U.f) / U.all;
  const ws = U.trades.map((r) => ({ ...r, name: shortT(r.a) })).filter((r) => r.n >= 5e5).map((r) => ({ ...r, sh: (100 * r.f) / r.n })).sort((a, b) => b.sh - a.sh);
  return figure({
    bare: true, file: "india-atlas_asuse-2025_women-share-by-activity",
    label: `Women's share of informal workers by activity, 2025, from ${ws[0].name} at ${ws[0].sh.toFixed(1)} per cent to ${ws.at(-1).name} at ${ws.at(-1).sh.toFixed(1)}; all activities ${all.toFixed(1)}`,
    data: csvOf(["activity", "workers_2025", "female_workers_2025", "female_share_pct"], ws.map((r) => [r.a, r.n, r.f, +r.sh.toFixed(1)])),
    draw: (width) => K.bars({ width, unit: PCT, dp: 1, rows: ws.map((r, i) => ({ name: fit(r.name, width), value: +r.sh.toFixed(1), highlight: i === 0 || i === ws.length - 1 })),
      ref: { value: +all.toFixed(1), label: `All activities ${all.toFixed(1)}%` } }),
  });
}

/* ---------- §07: GVA per worker, one scale ---------- */
export function mult() {
  const rows = [
    { name: "Factory, ASI (derived)", value: gvaPerPersonASI, highlight: true },
    { name: "Informal, hires workers", value: last(UA.gva_per_worker_hwe) },
    { name: "Informal, all", value: last(UA.gva_per_worker_all) },
    { name: "Informal, own-account", value: last(UA.gva_per_worker_oae) },
  ];
  const f = (v) => "₹" + v.toFixed(1) + " lakh"; // v in ₹ lakh
  return figure({
    bare: true, file: "india-atlas_asi-asuse_gva-per-worker_2023-24",
    label: `Gross value added per worker, ₹ a year, nominal, 2023-24: ${rows.map((r) => `${r.name} ${f(r.value / 1e5)}`).join(", ")}; the factory multiple over all unincorporated establishments is ${multAll.toFixed(1)} times`,
    data: csvOf(["category", "gva_per_worker_inr_per_year"], rows.map((r) => [r.name, Math.round(r.value)])),
    draw: (width) => K.bars({ width, fmt: f, unit: { suffix: " lakh" }, sort: false, rows: rows.map((r) => ({ ...r, name: fit(r.name, width), value: r.value / 1e5 })) }),
  });
}

/* ---------- §08: the informal economy by activity and sector, rural against urban ---------- */
const ACTS = [["manufacturing", "Manufacturing"], ["trading", "Trading"], ["other_services", "Other services"]];
const secPick = (metric, sector, act) => USec[metric + "_" + sector + "_" + act].data.at(-1).value;
const secRows = (metric) => ACTS.map(([k, label]) => ({ activity: label, rural: secPick(metric, "rural", k), urban: secPick(metric, "urban", k) }));
export function sectors() {
  const wrk = secRows("workers"), gpw = secRows("gva_per_worker"), est = secRows("establishments");
  const db = (rows, scale, dp, width) => K.dumbbell({ width, keys: { a: "Rural", b: "Urban" }, dp, sortBy: "none",
    aColor: K.C.ink2, rows: rows.map((r) => ({ name: r.activity, a: r.rural * scale, b: r.urban * scale })) });
  return figure({
    bare: true, file: "india-atlas_asuse_sectoral-structure_2023-24",
    label: `Informal workers and GVA per worker by activity, rural against urban, 2023-24: ${wrk.map((r) => `${r.activity} ${croreN(r.rural)} crore rural and ${croreN(r.urban)} crore urban workers`).join("; ")}`,
    data: csvOf(["metric", "activity", "sector", "value_2023_24"], [
      ...["workers", "establishments", "gva_per_worker"].flatMap((m) => { const R = m === "workers" ? wrk : m === "establishments" ? est : gpw; return [...R.map((r) => [m, r.activity, "Rural", r.rural]), ...R.map((r) => [m, r.activity, "Urban", r.urban])]; }),
    ]),
    draw: (width) => stack([
      { name: "Workers", sub: "crore, 2023-24", svg: db(wrk, 1e-7, 2, width) },
      { name: "GVA per worker", sub: "₹ lakh a year, 2023-24", svg: db(gpw, 1e-5, 2, width) },
    ]),
  });
}

/* ---------- §08: where the informal workers are ---------- */
function ustRows() {
  const rename = { "Dadra & Nagar Haveli and Daman & Diu": "DNH & Daman & Diu" };
  const rows = [];
  for (const [k, s] of Object.entries(asuseStB.series)) {
    if (!k.startsWith("wrk_")) continue;
    const v = s.data.at(-1); if (v == null || v === 0) continue;
    const nm = s.label.split(" · ")[1];
    rows.push({ state: rename[nm] || nm, workers: v });
  }
  const total = rows.reduce((a, r) => a + r.workers, 0);
  rows.forEach((r) => (r.share = (r.workers / total) * 100));
  return rows.sort((a, b) => b.share - a.share);
}
export function ust() {
  const rows = ustRows(), s3 = rows.slice(0, 3).reduce((a, r) => a + r.share, 0);
  return figure({
    bare: true, file: "india-atlas_asuse_state-worker-shares_2023-24",
    label: `Share of informal workers by state and union territory, 2023-24: ${rows.slice(0, 3).map((r) => `${r.state} ${r.share.toFixed(1)} per cent`).join(", ")}, together ${s3.toFixed(1)} per cent`,
    data: csvOf(["state", "workers_share_pct", "workers_count_2023_24"], rows.map((r) => [r.state, +r.share.toFixed(1), r.workers])),
    draw: (width) => K.bars({ width, unit: PCT, dp: 1, rows: rows.map((r, i) => ({ name: fit(r.state, width), value: +r.share.toFixed(1), highlight: i < 3 })) }),
  });
}

/* ---------- §09: the paperwork and the wires ---------- */
const modernRows = () => {
  const m = (k) => last(UM[k]);
  return [
    { name: "Bank or post-office account", value: m("bank_any_account_combined") },
    { name: "Registered under no act", value: m("reg_not_registered_combined") },
    { name: "Using the internet", value: m("internet_all_combined"), highlight: true },
    { name: "State licence or registration", value: m("reg_state_licence_combined") },
    { name: "Account in the firm's name", value: m("bank_estab_account_combined") },
    { name: "RTO registration", value: m("reg_rto_combined") },
    { name: "Shops & Establishments Act", value: m("reg_shops_estb_act_combined") },
    { name: "Using a computer", value: m("computer_all_combined") },
    { name: "GST registration", value: m("reg_cgst_act_combined") },
  ].sort((a, b) => b.value - a.value);
};
export function modern() {
  const rows = modernRows();
  return figure({
    bare: true, file: "india-atlas_asuse_paperwork-and-wires_2023-24",
    label: `Rates per 1,000 unincorporated establishments, 2023-24: ${rows.map((r) => `${r.name} ${fmtIN(r.value)}`).join(", ")}`,
    data: csvOf(["metric", "per_1000_2023_24"], rows.map((r) => [r.name, r.value])),
    draw: (width) => K.bars({ width, fmt: fmtIN, rows: rows.map((r) => ({ ...r, name: fit(r.name, width) })) }),
  });
}

/* ---------- the page's numbers and table rows, by element id ---------- */
export function numbers() {
  const N = {};
  const setTxt = (id, t) => { N[id] = esc(t); };
  const setHTML = (id, h) => { N[id] = h; };
  const spark = (s) => K.spark(s.data.filter((d) => d.value != null).map((d) => [d.date.toISOString().slice(0, 10), d.value]), { width: 190, height: 44 });

  // titleblock
  setHTML("n-fact", lakhOf(last(H.factories_in_operation), 2) + pc("lakh"));
  setHTML("d-fact", `<b>${arrow(last(H.factories_in_operation) - prevV(H.factories_in_operation), fmtIN)}</b> vs ${fy(H.factories_in_operation.data.at(-2).date)}`);
  setHTML("n-pers", croreN(last(H.persons_engaged)) + pc("crore"));
  setHTML("d-pers", `<b>${arrow(last(H.persons_engaged) - prevV(H.persons_engaged), (v) => lakhOf(v) + " lakh")}</b> vs ${fy(H.persons_engaged.data.at(-2).date)}`);
  setHTML("n-inf", croreN(last(UA.establishments_all)) + pc("crore"));
  setHTML("d-inf", `<b>${arrow(last(UA.establishments_all) - prevV(UA.establishments_all), (v) => lakhOf(v) + " lakh")}</b> vs ${fy(UA.establishments_all.data.at(-2).date)}, ASUSE`);
  setHTML("n-mult", multAll.toFixed(1) + pc("×"));
  setHTML("d-mult", `<b>₹${lakhOf(gvaPerPersonASI)} lakh</b> vs <b>₹${lakhOf(last(UA.gva_per_worker_all))} lakh</b>, per worker, nominal`);
  setHTML("nspark-fact", spark(H.factories_in_operation));

  // §01 current reading
  setHTML("rb-formal", croreN(last(H.persons_engaged)) + pc("crore"));
  setHTML("rb-informal", croreN(last(UA.workers_all)) + pc("crore"));
  setTxt("rt-ratio", (last(UA.workers_all) / last(H.persons_engaged)).toFixed(1));
  setTxt("cr-fop", fmtIN(last(H.factories_in_operation)));
  setTxt("cr-freg", fmtIN(last(H.number_of_factories)));
  setTxt("cr-pers", croreN(last(H.persons_engaged)) + " crore");
  setTxt("cr-fgva", lakhCr(last(H.gva)) + "ore");
  setTxt("cr-gpwf", "₹" + lakhOf(gvaPerPersonASI) + " lakh");
  setTxt("cr-est", croreN(last(UA.establishments_all)) + " crore");
  setTxt("cr-wrk", croreN(last(UA.workers_all)) + " crore");
  setTxt("cr-gpwi", "₹" + fmtIN(last(UA.gva_per_worker_all)));
  setTxt("cr-mult", multAll.toFixed(1) + "×");

  // §02 register of series
  const per1000 = (v) => fmtIN(v) + " / 1,000";
  const regRows = [
    [H.factories_in_operation, "Factories in operation", "ASI, count, from 2008-09", "s-acc", fmtIN, fmtIN],
    [H.persons_engaged, "Persons engaged", "ASI, count, all registered factories", "s-g1", (v) => croreN(v) + " cr", (v) => lakhOf(v) + " lakh"],
    [H.gva, "Factory gross value added", "ASI, ₹ lakh cr, nominal", "s-acc", (v) => lakhCr(v), (v) => lakhCr(v)],
    [H.emoluments, "Emoluments: wages & salaries", "ASI, ₹ lakh cr, nominal", "s-g4", (v) => lakhCr(v), (v) => lakhCr(v)],
    [H.total_output, "Gross output", "ASI, ₹ lakh cr, nominal", "s-g3", (v) => lakhCr(v), (v) => lakhCr(v)],
    [UA.establishments_all, "Establishments, unincorporated", "ASUSE, count, from 2021-22", "s-g2", (v) => croreN(v) + " cr", (v) => lakhOf(v) + " lakh"],
    [UA.workers_all, "Workers, unincorporated", "ASUSE, count, from 2021-22", "s-g2", (v) => croreN(v) + " cr", (v) => lakhOf(v) + " lakh"],
    [UA.gva_per_worker_all, "GVA per worker", "ASUSE, ₹ per year, market establishments", "s-g1", (v) => "₹" + fmtIN(v), (v) => "₹" + fmtIN(v)],
    [UA.emoluments_per_hired_worker_hwe, "Emoluments per hired worker", "ASUSE, HWE only, ₹ per year", "s-g4", (v) => "₹" + fmtIN(v), (v) => "₹" + fmtIN(v)],
    [UM.internet_all_combined, "Establishments using the internet", "ASUSE, per 1,000, from 2021-22", "s-acc", per1000, fmtIN],
    [UM.reg_not_registered_combined, "Registered under no act", "ASUSE, per 1,000, from 2021-22", "s-g1", per1000, fmtIN],
    [US.own_proprietary_female_combined, "Female-proprietor establishments", "ASUSE, per 1,000, from 2021-22", "s-g4", per1000, fmtIN],
  ];
  setHTML("ledger-body", regRows.map(([s, nm, sub, sw, fV, fD]) => {
    const data = s.data.filter((d) => d.value != null);
    return `<tr><td class="name"><span class="sw ${sw}"></span>${esc(nm)}<small>${esc(sub)}</small></td>` +
      `<td class="val">${fV(data.at(-1).value)}</td><td class="chg">${arrow(data.at(-1).value - data.at(-2).value, fD)}, vs ${fy(data.at(-2).date)}</td>` +
      `<td class="yr">${fV(data[0].value)}, ${fy(data[0].date)}</td><td class="spark">${spark(s)}</td></tr>`;
  }).join(""));

  // §03 the long century
  { const lastPt = (s) => s.data.filter((d) => d.value != null).at(-1), firstPt = (s) => s.data.filter((d) => d.value != null)[0];
    setTxt("pv-long", lakhOf(lastPt(L87.number_of_factories).value, 2) + " → " + lakhOf(lastPt(H.number_of_factories).value, 2) + " lakh");
    setTxt("ex-l87", fmtIN(firstPt(L87.number_of_factories).value));
    setTxt("ex-l98", fmtIN(lastPt(L87.number_of_factories).value));
    setTxt("ex-l02", fmtIN(L98.number_of_factories.data.find((d) => d.date.getUTCFullYear() === 2001).value));
    setTxt("ex-lp97", croreN(lastPt(L87.persons_engaged).value) + " crore");
    setTxt("ex-lp03", croreN(lastPt(L98.persons_engaged).value) + " crore");
    setTxt("ex-lp23", croreN(lastPt(H.persons_engaged).value) + " crore"); }
  // the counts
  setTxt("pv-count", fmtIN(last(H.factories_in_operation)));
  setTxt("ex-c1", fmtIN(last(H.factories_in_operation)));
  setTxt("ex-c0", fmtIN(firstV(H.factories_in_operation)));
  setTxt("ex-cp", croreN(last(H.persons_engaged)) + " crore");
  setTxt("ex-cw", croreN(last(H.workers)) + " crore");
  setTxt("ex-cavg", fmtIN(last(H.persons_engaged) / last(H.factories_in_operation)));
  // the money
  setTxt("pv-money", lakhCr(last(H.gva)));
  setTxt("ex-m1", lakhCr(last(H.gva)) + "ore");
  setTxt("ex-m0", lakhCr(firstV(H.gva)) + "ore");
  setTxt("ex-mx", (last(H.gva) / firstV(H.gva)).toFixed(1) + "×");
  setTxt("ex-me", lakhCr(last(H.emoluments)) + "ore");
  setTxt("ex-mw", "₹" + lakhOf(emolPerPersonASI) + " lakh");
  // states
  { const rows = stateRows(), share3 = rows.slice(0, 3).reduce((a, r) => a + r.share, 0), share5 = rows.slice(0, 5).reduce((a, r) => a + r.share, 0);
    setTxt("pv-states", share3.toFixed(1) + "%"); setTxt("ex-s1", rows[0].share.toFixed(1) + "%");
    setTxt("ex-s3", share3.toFixed(1) + "%"); setTxt("ex-s5", share5.toFixed(1) + "%");
    setTxt("ex-stn", fmtIN(statesB.series.factories_in_operation_tamil_nadu.data.at(-1)));
    setTxt("ex-smh", fmtIN(statesB.series.factories_in_operation_maharashtra.data.at(-1))); }
  // industries
  { const cells = indCells(), share5 = cells.slice(0, 5).reduce((a, c) => a + c.sh, 0);
    setTxt("pv-ind", share5.toFixed(1) + "%");
    setTxt("ex-i1", cells[0].sh.toFixed(1) + "%"); setTxt("ex-i2", cells[1].sh.toFixed(1) + "%"); setTxt("ex-i3", cells[2].sh.toFixed(1) + "%");
    setTxt("ex-i5", share5.toFixed(1) + "%"); }
  { const { labour, capTop } = jvPoints();
    setTxt("pv-jv", labour[0].name + ", " + labour[0].e.toFixed(1) + "% of jobs, " + labour[0].g.toFixed(1) + "% of value");
    setTxt("ex-jv-lab", labour[0].name + ": " + labour[0].e.toFixed(1) + "% of jobs, " + labour[0].g.toFixed(1) + "% of value");
    setTxt("ex-jv-cap", capTop.name + ": " + capTop.g.toFixed(1) + "% of value, " + capTop.e.toFixed(1) + "% of jobs"); }
  { const rows = labRows(), share3 = rows.slice(0, 3).reduce((a, r) => a + r.share, 0), share5 = rows.slice(0, 5).reduce((a, r) => a + r.share, 0);
    setTxt("pv-lab", share3.toFixed(1) + "%");
    for (const i of [0, 1, 2]) setTxt("ex-lb" + (i + 1), rows[i].name + ", " + rows[i].share.toFixed(1) + "%");
    setTxt("ex-lb5", share5.toFixed(1) + "%"); }
  { const { rows, allWage, allSize } = wageSize();
    const inr = (v) => "₹" + fmtIN(v), inrL = (v) => (v >= 1e5 ? "₹" + (v / 1e5).toFixed(1) + " lakh" : "₹" + fmtIN(v));
    setTxt("pv-wage", inrL(allWage)); setTxt("wg-all", inrL(allWage));
    setTxt("wg-month", inr(Math.round(allWage / 12 / 100) * 100));
    setTxt("wg-below", numWord(rows.filter((r) => r.wage < allWage).length, true));
    setTxt("wg-n", String(rows.length));
    setTxt("wg-big", [...rows].sort((a, b) => b.p - a.p).slice(0, 3).map((r) => r.name.toLowerCase() + " " + inrL(r.wage)).join(", ").replace(/, ([^,]*)$/, " and $1"));
    const sr = [...rows].sort((a, b) => b.size - a.size);
    setTxt("pv-size", String(Math.round(allSize))); setTxt("sz-all", String(Math.round(allSize)));
    setTxt("sz-top", sr.slice(0, 3).map((r) => r.name.toLowerCase() + " (" + Math.round(r.size) + ")").join(", "));
    setTxt("sz-low", sr.slice(-3).reverse().map((r) => r.name.toLowerCase() + " (" + Math.round(r.size) + ")").join(", ")); }

  // §07 the other economy: two share bars drawn as HTML strips
  { const estOAE = last(UA.establishments_oae), estHWE = last(UA.establishments_hwe), estAll = last(UA.establishments_all);
    const wrkOAE = last(UA.workers_oae), wrkHWE = last(UA.workers_hwe), wrkAll = last(UA.workers_all);
    setTxt("ot-oaesh", (estOAE / estAll * 100).toFixed(1) + "%");
    setTxt("ot-hwesh", (estHWE / estAll * 100).toFixed(1) + "%");
    setTxt("ot-hwewk", (wrkHWE / wrkAll * 100).toFixed(1) + "%");
    const baskets = [
      ["bar-est", "lab-est", [["Establishments: own-account (OAE), nobody hired", estOAE, estAll, K.C.ctx2], ["Hired-worker establishments (HWE)", estHWE, estAll, K.C.lead]]],
      ["bar-wrk", "lab-wrk", [["Workers: in own-account establishments", wrkOAE, wrkAll, K.C.ctx2], ["Workers in hired-worker establishments", wrkHWE, wrkAll, K.C.lead]]],
    ];
    for (const [barId, labId, segs] of baskets) {
      setHTML(barId, segs.map(([n, v, t, c]) => `<div class="seg" style="width:${(v / t * 100).toFixed(1)}%;background:${c}" title="${esc(n)}: ${(v / t * 100).toFixed(1)}%"></div>`).join(""));
      setHTML(labId, segs.map(([n, v, t, c]) => `<div class="blab"><div class="n"><span class="sw" style="background:${c}"></span>${esc(n)}</div><div class="w">${croreN(v)} cr, ${(v / t * 100).toFixed(1)}%, 2023-24</div></div>`).join(""));
    }
    const qEst = UQ.establishments_00_all_activities;
    setTxt("q-now", croreN(last(qEst) * 100) + " crore");
    const qYear = qEst.data.at(-5)?.value;
    if (qYear != null) setTxt("q-then", croreN(qYear * 100) + " crore"); }
  // GVA per worker
  setTxt("pv-mult", multAll.toFixed(1) + "×");
  setTxt("ex-x1", "₹" + lakhOf(gvaPerPersonASI) + " lakh");
  setTxt("ex-x2", "₹" + fmtIN(last(UA.gva_per_worker_all)));
  setTxt("ex-x3", multAll.toFixed(1) + "×");
  setTxt("ex-x4", multOAE.toFixed(1) + "×");
  setTxt("ex-x5", "₹" + lakhOf(emolPerPersonASI) + " lakh");
  setTxt("ex-x6", "₹" + lakhOf(last(UA.emoluments_per_hired_worker_hwe)) + " lakh");
  setTxt("ex-x7", wageMult.toFixed(1) + "×");
  // sectors
  { const wrk = secRows("workers"), est = secRows("establishments");
    const totEstR = est.reduce((a, d) => a + d.rural, 0), totEstU = est.reduce((a, d) => a + d.urban, 0);
    const totWrkR = wrk.reduce((a, d) => a + d.rural, 0), totWrkU = wrk.reduce((a, d) => a + d.urban, 0);
    setTxt("pv-sec", (totEstR / (totEstR + totEstU) * 100).toFixed(0) + "%");
    setTxt("ex-sec-estr", (totEstR / (totEstR + totEstU) * 100).toFixed(0) + "%");
    setTxt("ex-sec-estu", (totEstU / (totEstR + totEstU) * 100).toFixed(0) + "%");
    setTxt("ex-sec-wrkr", croreN(totWrkR) + " cr");
    setTxt("ex-sec-wrku", croreN(totWrkU) + " cr");
    const gap = ACTS.map(([k]) => secPick("gva_per_worker", "urban", k) / secPick("gva_per_worker", "rural", k));
    setTxt("ex-sec-gap", gap[0].toFixed(1) + "×"); setTxt("ex-sec-gaps", gap[2].toFixed(1) + "×"); }
  // informal states
  { const rows = ustRows(), share3 = rows.slice(0, 3).reduce((a, r) => a + r.share, 0), share5 = rows.slice(0, 5).reduce((a, r) => a + r.share, 0);
    setTxt("pv-ust", share3.toFixed(1) + "%"); setTxt("ex-ust1", rows[0].state + ", " + rows[0].share.toFixed(1) + "%");
    setTxt("ex-ust3", share3.toFixed(1) + "%"); setTxt("ex-ust5", share5.toFixed(1) + "%"); }

  // §09 the informal firm, described: share strips as HTML
  const basket = (barId, labId, segs, denom) => {
    setHTML(barId, segs.map(([n, v, c]) => `<div class="seg" style="width:${(v / 10).toFixed(1)}%;background:${c}" title="${esc(n)}: ${v} per 1,000"></div>`).join(""));
    setHTML(labId, segs.map(([n, v, c]) => `<div class="blab"><div class="n"><span class="sw" style="background:${c}"></span>${esc(n)}</div><div class="w">${fmtIN(v)} / 1,000 ${esc(denom)}, 2023-24</div></div>`).join(""));
  };
  setTxt("if-reg", fmtIN(last(UM.reg_not_registered_combined)));
  setTxt("if-comp", fmtIN(last(UM.computer_all_combined)));
  { const soc = (g) => last(UO[`social_${g}_combined`]), own = (g) => last(US[`own_${g}_combined`]), edu = (g) => last(UO[`edu_${g}_combined`]);
    basket("bar-social", "lab-social", [
      ["Other Backward Classes", soc("obc"), "#2E4BD8"], ["Scheduled Caste", soc("sc"), "#5F6675"], ["Scheduled Tribe", soc("st"), "#878D99"],
      ["Others", soc("others"), "#C9CED6"], ["Not known", soc("not_known"), "#ECEEF2"]], "proprietary & partnership estts.");
    const collective = own("partnership_same_hh") + own("partnership_diff_hh") + own("shg") + own("society_trust") + own("cooperatives") + own("others");
    basket("bar-sex", "lab-sex", [["Proprietary: male owner", own("proprietary_male"), "#5F6675"], ["Proprietary: female owner", own("proprietary_female"), "#2E4BD8"],
      ["Partnerships, SHGs, societies, co-operatives", collective, "#C9CED6"]], "of all establishments");
    setTxt("pv-owner", fmtIN(soc("obc") + soc("sc") + soc("st")) + " / 1,000");
    setTxt("ex-o-obc", fmtIN(soc("obc"))); setTxt("ex-o-sc", fmtIN(soc("sc"))); setTxt("ex-o-st", fmtIN(soc("st")));
    setTxt("ex-o-fem", fmtIN(Math.round(own("proprietary_female") / own("proprietary_all") * 1000)));
    setTxt("ex-o-edu", fmtIN(edu("not_literate") + edu("below_primary") + edu("primary_to_secondary"))); }
  { const m = (k) => last(UM[k]);
    setTxt("pv-modern", fmtIN(m("internet_all_combined")));
    setTxt("ex-m-bank", fmtIN(m("bank_any_account_combined"))); setTxt("ex-m-net", fmtIN(m("internet_all_combined")));
    setTxt("ex-m-comp", fmtIN(m("computer_all_combined"))); setTxt("ex-m-gst", fmtIN(m("reg_cgst_act_combined")));
    setTxt("ex-m-shops", fmtIN(m("reg_shops_estb_act_combined"))); setTxt("ex-m-none", fmtIN(m("reg_not_registered_combined")));
    setTxt("ex-m-hwe", fmtIN(m("internet_hwe_combined"))); setTxt("ex-m-oae", fmtIN(m("internet_oae_combined"))); }
  { const s = (k) => last(US[k]);
    basket("bar-loc", "lab-loc", [["Within the household premises", s("loc_within_household_combined"), "#5F6675"], ["Fixed premises, permanent structure", s("loc_fixed_permanent_combined"), "#878D99"],
      ["Fixed premises, temporary / kiosk / stall", s("loc_fixed_temporary_combined"), "#A3A9B4"], ["Fixed premises, no structure", s("loc_fixed_no_structure_combined"), "#C9CED6"],
      ["Mobile markets", s("loc_mobile_market_combined"), "#E3E6EB"], ["Street vending, no fixed premises", s("loc_street_vendor_combined"), "#2E4BD8"]], "by location");
    basket("bar-months", "lab-months", [["3 months or fewer", s("months_le3_combined"), "#2E4BD8"], ["4 to 6 months", s("months_4_6_combined"), "#C9CED6"],
      ["7 to 9 months", s("months_7_9_combined"), "#A3A9B4"], ["More than 9 months", s("months_gt9_combined"), "#5F6675"]], "by months operated");
    basket("bar-hours", "lab-hours", [["Under 4 hours a day", s("hours_lt4_combined"), "#C9CED6"], ["4 to 7 hours", s("hours_4_7_combined"), "#A3A9B4"],
      ["8 to 11 hours", s("hours_8_11_combined"), "#5F6675"], ["Over 11 hours", s("hours_gt11_combined"), "#2E4BD8"]], "by hours worked");
    setTxt("pv-rhythm", fmtIN(s("months_gt9_combined")) + " / 1,000");
    setTxt("ex-r-house", fmtIN(s("loc_within_household_combined"))); setTxt("ex-r-perm", fmtIN(s("loc_fixed_permanent_combined")));
    setTxt("ex-r-street", fmtIN(s("loc_street_vendor_combined") + s("loc_mobile_market_combined")));
    setTxt("ex-r-m9", fmtIN(s("months_gt9_combined"))); setTxt("ex-r-h8", fmtIN(s("hours_8_11_combined")));
    setTxt("ex-r-avg", s("months_avg_combined").toFixed(1)); }

  // §10 the factory accounts, complete
  { const codes = Object.keys(accountsB.series).map((k) => Number(k.slice(1))).sort((a, b) => a - b);
    const unitLabel = (code, unit) => (code === 42 ? "thousand mandays" : { inr_lakh: "₹ lakh, nominal", count: "count", thousand: "₹ thousand, nominal", thousand_kwh: "thousand kWh", thousand_tonne: "thousand tonnes" }[unit] ?? unit);
    const fmtVal = (code, unit, v) => {
      if (v == null) return "–";
      const sign = v < 0 ? "−" : "", a = Math.abs(v);
      if (unit === "inr_lakh") return sign + (a >= 1e7 ? "₹" + (a / 1e7).toFixed(1) + " L cr" : "₹" + fmtIN(Math.round(a / 100)) + " cr");
      if (unit === "count") return sign + (a >= 1e7 ? croreN(a) + " cr" : a >= 2e5 ? lakhOf(a) + " lakh" : fmtIN(a));
      if (code === 42) return sign + croreN(a * 1000) + " cr days";
      if (unit === "thousand") return sign + "₹" + (a / 1e9).toFixed(1) + " L cr";
      if (unit === "thousand_kwh") return sign + fmtIN(Math.round(a / 1e6)) + " bn kWh";
      if (unit === "thousand_tonne") return sign + croreN(a * 1000, 1) + " cr t";
      return sign + fmtIN(a);
    };
    setHTML("acct-body", codes.map((code) => {
      const key = "i" + String(code).padStart(2, "0"), unit = accountsB.series[key].unit, s = ACC[key];
      const pts = s.data.filter((d) => d.value != null), latest = pts.at(-1), prev = pts.at(-2), first = pts[0];
      const f = (v) => fmtVal(code, unit, v);
      return `<tr><td class="name">${esc(s.label)}<small>ASI ${code}, ${esc(unitLabel(code, unit))}</small></td><td class="val">${f(latest.value)}</td>` +
        `<td class="chg">${arrow(latest.value - prev.value, (d) => f(d))}</td><td class="yr">${f(first.value)}, ${fy(first.date)}</td><td class="spark">${spark(s)}</td></tr>`;
    }).join(""));
    setTxt("pv-acct", lakhCr(last(ACC.i19)));
    setTxt("ex-a-emol", lakhCr(last(ACC.i43)) + "ore");
    setTxt("ex-a-wrk", lakhCr(last(ACC.i46)) + "ore");
    setTxt("ex-a-con", (last(ACC.i37) / last(ACC.i32) * 100).toFixed(1) + "%");
    setTxt("ex-a-mand", croreN(last(ACC.i42) * 1000, 0));
    setTxt("ex-a-fuel", lakhCr(last(ACC.i16)) + "ore");
    setTxt("ex-a-elec", lakhCr(last(ACC.i54) / 100) + "ore"); }

  setTxt("prov-vintage", headlineB.meta.vintage);
  setTxt("prov-vintage2", headlineB.meta.vintage);
  return N;
}

/** §08 numbers that read the frontmatter's build-time picks (asi-nic4, the state mixes, the 2025 round). */
export function deepNumbers(A, U) {
  const N = {}, setTxt = (id, t) => { N[id] = esc(t); };
  if (A.topClasses.length) {
    const rows = A.topClasses.map((r) => ({ ...r, name: shortClass(r.name) })), top = rows[0];
    const share = rows.reduce((a, r) => a + r.sh, 0), psh = rows.reduce((a, r) => a + (r.psh ?? 0), 0);
    setTxt("pv-nic4", share.toFixed(1) + "%");
    setTxt("n4-top", top.name.replace(/^\d+ /, "").toLowerCase() + " (NIC " + top.code + "), " + top.sh.toFixed(1) + "%");
    setTxt("n4-share", share.toFixed(1) + "%"); setTxt("n4-pshare", psh.toFixed(1) + "%");
  }
  if (A.mix.length) {
    const { colName } = mixCols(A);
    const cells = A.mix.flatMap((m) => [...m.cells.map((c) => ({ state: m.state, col: colName(c.code), sh: c.sh })), { state: m.state, col: "All other", sh: m.other }]);
    const peak = cells.filter((c) => c.col !== "All other" && c.sh != null).sort((a, b) => b.sh - a.sh)[0];
    const varied = [...A.mix].sort((a, b) => b.other - a.other)[0];
    setTxt("pv-statemix", peak.sh.toFixed(1) + "%");
    setTxt("sm-peak", peak.col.toLowerCase() + " in " + peak.state + ", " + peak.sh.toFixed(1) + "% of its factory value added");
    setTxt("sm-div", varied.state + " (" + varied.other.toFixed(1) + "% in divisions outside the eight)");
    setTxt("sm-cols", A.divs.map((d) => { const best = cells.filter((c) => c.col === colName(d.code) && c.sh != null).sort((a, b) => b.sh - a.sh)[0]; return colName(d.code).toLowerCase() + " in " + best.state + " (" + best.sh.toFixed(1) + "%)"; }).join(", ").replace(/, ([^,]*)$/, " and $1"));
  }
  setTxt("pv-trades", (U.all / 1e7).toFixed(1));
  setTxt("pv-women", ((100 * U.f) / U.all).toFixed(1) + "%");
  return N;
}
