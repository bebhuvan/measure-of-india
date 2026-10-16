// Renewable energy (MNRE) guide: the plates, drawn at build time with the chart kit (src/kit/), and
// the page's number wiring. Each chart export returns a bare figure for a plate's .plotzone; the
// plate's title, source line and buttons stay in src/pages/guides/mnre.astro. numbers() returns
// the HTML for every number id on the page, computed exactly as the old client script did.
// Values are cumulative installed capacity in MW, shown in GW. The Dec 2023 classification break
// (large hydro added) is marked on every chart that crosses it; no line is joined across it.
import * as K from "../kit/kit.js";
import { figure } from "../kit/figure.js";
import srcB from "../../data/series/mnre-sources.json";
import solB from "../../data/series/mnre-solar-categories.json";
import stB from "../../data/series/mnre-states.json";
import stSolB from "../../data/series/mnre-states-solar.json";
import stWindB from "../../data/series/mnre-states-wind.json";
import stHydroB from "../../data/series/mnre-states-hydro.json";
import stBioB from "../../data/series/mnre-states-bio.json";
import bioB from "../../data/series/mnre-bio-categories.json";

/* ---------- bundles as {date, value} lists (dates as UTC Dates, as the old client had them) ---------- */
function hydrate(b) {
  const dates = b.dates.map((d) => new Date(d + "T00:00:00Z")), out = {};
  for (const [k, s] of Object.entries(b.series)) out[k] = { label: s.label, data: s.data.map((v, i) => ({ date: dates[i], iso: b.dates[i], value: v })) };
  return out;
}
const S = hydrate(srcB), SOL = hydrate(solB), BIO = hydrate(bioB);

/* ---------- formatters (byte-identical to the retired client) ---------- */
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const pc = (u) => `<span class="pc">${u}</span>`;
const fmtMY = (d) => MON[d.getUTCMonth()] + " " + d.getUTCFullYear();
const gw = (v, dp = 1) => (v / 1000).toFixed(dp);
const last = (s) => s.data.filter((d) => d.value != null).at(-1).value;
const prevV = (s) => s.data.filter((d) => d.value != null).at(-2).value;
const firstV = (s) => s.data.filter((d) => d.value != null)[0].value;
const atYearAgo = (s) => { const d = s.data.filter((d) => d.value != null); const t = d.at(-1).date.getTime() - 365.25 * 86400000; let best = null; for (const p of d) { if (p.date.getTime() <= t) best = p; else break; } return best ? best.value : null; };
const arrow = (d, f) => (d >= 0 ? "▲ +" : "▼ −") + f(Math.abs(d));
const LATEST_SHORT = fmtMY(S.grand_total.data.filter((x) => x.value != null).at(-1).date);
const YEAR_AGO_SHORT = LATEST_SHORT.replace(/\d{4}$/, (y) => String(+y - 1));
const tc = (t) => t.replace(/\b\w/g, (c) => c.toUpperCase());
const NB = (s) => s.replace(/ /g, " "); // keeps a two-word end label whole on a phone

/** [[iso, GW]] for one series: nulls kept, so a missing month is a gap. */
const gwPairs = (s) => s.data.map((d) => [d.iso, d.value == null ? null : d.value / 1000]);
const GW = { suffix: " GW" };

/* ---------- rankings shared by numbers and charts ---------- */
const SHORT_STATE = { "The Dadra and Nagar Haveli and Daman and Diu": "DNH & Daman & Diu", "Dadra and Nagar Haveli and Daman and Diu": "DNH & Daman & Diu", "Andaman and Nicobar Islands": "Andaman & Nicobar Is." };
const shortState = (s) => SHORT_STATE[s] || s;
const solarEntries = () => Object.entries(stSolB.series).filter(([k]) => !k.includes("__")).map(([k, s]) => ({ state: shortState(s.label.split(" · ")[1] || k), v: s.data.at(-1) }));
const totalEntries = () => Object.entries(stB.series).map(([k, s]) => ({ state: shortState(s.label.split(" · ")[1] || k), v: s.data.at(-1) }));
const topStates = () => Object.entries(stB.series).map(([k, s]) => ({ k, label: s.label.split(" · ")[1], v: s.data.at(-1) })).filter((d) => d.v != null && d.v > 0).sort((a, b) => b.v - a.v).slice(0, 6);
const SRC = [["Wind", stWindB, null], ["Large hydro", stHydroB, "__large_hydro"], ["Small hydro", stHydroB, "__small_hydro"], ["Bio power", stBioB, "__total"]];
const srcShares = () => {
  const all = {};
  for (const [name, b, suf] of SRC) {
    const ent = Object.entries(b.series).filter(([k]) => (suf ? k.endsWith(suf) : !k.includes("__")))
      .map(([, s]) => ({ state: s.group, last: s.data.at(-1) })).filter((d) => d.last != null && d.last > 0);
    const tot = ent.reduce((a, d) => a + d.last, 0);
    ent.sort((a, c) => c.last - a.last);
    all[name] = { ent, tot };
  }
  return all;
};
const rooftopEntries = () => Object.entries(stSolB.series).filter(([k]) => k.endsWith("__rooftop")).map(([, s]) => ({ state: s.group, v: s.data.at(-1) })).filter((d) => d.v != null && d.v > 0).sort((a, c) => c.v - a.v);
const compSegs = () => {
  const total = last(S.grand_total);
  return [["Solar Power", last(S.solar)], ["Wind Power", last(S.wind)], ["Bio Power", last(S.bio)], ["Small Hydro", last(S.small_hydro)], ["Large Hydro (from Dec 2023)", last(S.large_hydro)]]
    .filter(([, v]) => v > 0).map(([n, v]) => ({ n, v, share: v / total * 100 }));
};

/* ============================ numbers: id -> HTML ============================ */
export function numbers() {
  const N = {};
  const gt = S.grand_total;
  N["n-total"] = gw(last(gt)) + pc("GW");
  N["d-total"] = `<b>${arrow(last(gt) - prevV(gt), (v) => gw(v, 2) + " GW")}</b> vs ${fmtMY(gt.data.at(-2).date)}`;
  N["n-solar-share"] = (last(S.solar) / last(gt) * 100).toFixed(0) + pc("%");
  {
    const yrAgoTotal = atYearAgo(gt), yrAgoSolar = atYearAgo(S.solar);
    const shareNow = last(S.solar) / last(gt) * 100;
    const shareThen = yrAgoSolar && yrAgoTotal ? yrAgoSolar / yrAgoTotal * 100 : null;
    N["d-solar-share"] = shareThen != null ? `<b>${arrow(shareNow - shareThen, (v) => v.toFixed(0) + " pt")}</b> vs ${YEAR_AGO_SHORT}` : "—";
    const yoy = atYearAgo(gt), yoyPct = yoy ? ((last(gt) / yoy - 1) * 100) : null;
    N["n-yoy"] = yoyPct != null ? "+" + yoyPct.toFixed(0) + pc("%") : "—";
    N["d-yoy"] = yoyPct != null ? `<b>▲ +${gw(last(gt) - yoy)} GW</b> vs ${YEAR_AGO_SHORT}` : "—";
  }
  {
    const top = Object.entries(stB.series).filter(([k]) => !k.includes("__")).map(([k, s]) => ({ k, label: s.label, v: s.data.at(-1) })).filter((d) => d.v != null).sort((a, b) => b.v - a.v)[0];
    N["n-top-state"] = gw(top.v, 0) + pc("GW");
    N["d-top-state"] = `<b>${top.label.split(" · ")[1]}</b>, ${gw(top.v)} GW`;
  }
  // § 01
  N["rb-total"] = gw(last(gt)) + pc("GW");
  N["rb-solar"] = gw(last(S.solar)) + pc("GW");
  N["rt-solar"] = gw(last(S.solar)) + pc("GW");
  N["cr-total"] = gw(last(gt)) + pc("GW");
  N["cr-total-first"] = gw(firstV(gt)) + pc("GW");
  N["cr-growth"] = (((last(gt) - last(S.large_hydro)) / firstV(gt) - 1) * 100).toFixed(0) + pc("%"); // large hydro left out: no growth across the Dec 2023 seam
  N["cr-solar-share"] = (last(S.solar) / last(gt) * 100).toFixed(0) + pc("%");
  N["cr-wind-share"] = (last(S.wind) / last(gt) * 100).toFixed(0) + pc("%");
  N["cr-gm-share"] = (last(SOL.ground_mounted) / last(S.solar) * 100).toFixed(0) + pc("%");
  N["cr-rt-share"] = (last(SOL.rooftop) / last(S.solar) * 100).toFixed(0) + pc("%");
  // § 03
  N["pv-comp"] = (last(S.solar) / last(gt) * 100).toFixed(0) + pc("%");
  // § 04
  {
    const step = gt.data[srcB.dates.indexOf("2023-12-01")].value - gt.data[srcB.dates.indexOf("2023-11-01")].value;
    N["pv-total"] = gw(firstV(gt)) + " → " + gw(last(gt));
    N["ex-total-now"] = gw(last(gt)) + pc("GW");
    N["ex-total-first"] = gw(firstV(gt)) + pc("GW");
    N["ex-total-step"] = "+" + gw(step, 0) + pc("GW");
    N["ex-total-real"] = gw(last(gt) - step - firstV(gt)) + pc("GW");
  }
  // § 06
  N["pv-sources"] = (last(S.solar) / last(S.wind)).toFixed(1) + pc("×");
  N["ex-src-solar"] = gw(last(S.solar)) + pc("GW");
  N["ex-src-wind"] = gw(last(S.wind)) + pc("GW");
  N["ex-src-bio"] = gw(last(S.bio)) + pc("GW");
  N["ex-src-sh"] = gw(last(S.small_hydro), 1) + pc("GW");
  N["ex-src-ratio"] = (last(S.solar) / last(S.wind)).toFixed(1) + pc("×");
  N["ex-src-ratio0"] = (firstV(S.solar) / firstV(S.wind)).toFixed(2) + pc("×");
  // § 07
  N["pv-solar"] = (last(SOL.rooftop) / last(S.solar) * 100).toFixed(0) + pc("%");
  N["ex-sol-gm"] = gw(last(SOL.ground_mounted)) + pc("GW");
  N["ex-sol-rt"] = gw(last(SOL.rooftop)) + pc("GW");
  N["ex-sol-rtshare"] = (last(SOL.rooftop) / last(S.solar) * 100).toFixed(0) + pc("%");
  N["ex-sol-rtshare0"] = (firstV(SOL.rooftop) / firstV(S.solar) * 100).toFixed(0) + pc("%");
  // § 08 state lines: names come from the ranking, never typed into the page
  {
    const t = topStates(), totalAI = last(gt);
    const gr2 = (t[0].v + t[1].v) / totalAI * 100, next4 = t.slice(2, 6).reduce((a, d) => a + d.v, 0) / totalAI * 100;
    N["pv-sttime"] = gr2.toFixed(0) + pc("%");
    N["ex-st-n1"] = esc(tc(t[0].label)); N["ex-st-n2"] = esc(tc(t[1].label));
    N["ex-st-gj"] = gw(t[0].v) + pc("GW");
    N["ex-st-rj"] = gw(t[1].v) + pc("GW");
    N["ex-st-gr2"] = gr2.toFixed(0) + pc("%");
    const n4 = t.slice(2, 6).map((d) => tc(d.label));
    N["ex-st-next4n"] = esc(n4.slice(0, -1).join(", ") + " and " + n4.at(-1));
    N["ex-st-next4"] = next4.toFixed(0) + pc("%");
  }
  // § 08 strips
  {
    const sol = solarEntries().filter((d) => d.v > 0).sort((a, b) => b.v - a.v), tot = totalEntries().filter((d) => d.v > 0).sort((a, b) => b.v - a.v);
    N["pv-states"] = gw(sol[0].v, 0) + pc("GW");
    N["ex-sst-top"] = sol[0].state + ", " + gw(sol[0].v) + pc("GW");
    N["ex-tst-top"] = tot[0].state + ", " + gw(tot[0].v) + pc("GW");
    N["ex-tst-top5"] = (tot.slice(0, 5).reduce((a, r) => a + r.v, 0) / last(gt) * 100).toFixed(0) + pc("%");
  }
  // § 09 source maps
  {
    const all = srcShares();
    const topN = (n, k) => all[n].ent.slice(0, k).reduce((a, d) => a + d.last, 0) / all[n].tot * 100;
    const lead = (n, k = 3) => all[n].ent.slice(0, k).map((d) => `${d.state} ${(d.last / all[n].tot * 100).toFixed(0)}%`).join(", ");
    N["pv-srcmap"] = topN("Wind", 7).toFixed(1) + pc("%");
    N["ex-sm-wind"] = lead("Wind"); N["ex-sm-lh"] = lead("Large hydro"); N["ex-sm-sh"] = lead("Small hydro"); N["ex-sm-bio"] = lead("Bio power");
  }
  // § 09 rooftop
  {
    const ent = rooftopEntries(), tot = ent.reduce((a, d) => a + d.v, 0), share2 = (ent[0].v + ent[1].v) / tot * 100;
    N["pv-rooftop"] = share2.toFixed(0) + pc("%");
    N["ex-rt-total"] = gw(tot) + pc("GW");
    N["ex-rt-n1"] = esc(ent[0].state); N["ex-rt-v1"] = gw(ent[0].v, 2) + pc("GW");
    N["ex-rt-n2"] = esc(ent[1].state); N["ex-rt-v2"] = gw(ent[1].v, 2) + pc("GW");
    N["ex-rt-share"] = share2.toFixed(0) + pc("%");
  }
  // § 10
  {
    const tot = last(BIO.total);
    N["pv-bio"] = (last(BIO.bagasse) / tot * 100).toFixed(0) + pc("%");
    N["ex-bio-bag"] = gw(last(BIO.bagasse), 2) + pc("GW");
    N["ex-bio-nb"] = gw(last(BIO.non_bagasse), 2) + pc("GW");
    N["ex-bio-wte"] = gw(last(BIO.waste_to_energy), 2) + pc("GW");
    N["ex-bio-off"] = gw(last(BIO.waste_to_energy_off_grid), 2) + pc("GW");
    N["ex-bio-growth"] = ((tot / firstV(BIO.total) - 1) * 100).toFixed(0) + pc("%");
    N["ex-bio-solar"] = ((last(S.solar) / firstV(S.solar) - 1) * 100).toFixed(0) + pc("%");
  }
  N["prov-vintage"] = esc(srcB.meta.vintage);
  N["prov-vintage2"] = esc(srcB.meta.vintage);
  return N;
}
function esc(s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;"); }

/** § 02 the register: one row per series, its sparkline drawn by the kit. */
export function ledger() {
  const rows = [
    [S.grand_total, "Grand Total", "MNRE, MW, includes large hydro from Dec 2023", "s-acc"],
    [S.solar, "Solar Power", "MNRE, MW, Solar Power Total", "s-g1"],
    [S.wind, "Wind Power", "MNRE, MW", "s-g2"],
    [S.small_hydro, "Small Hydro Power", "MNRE, MW, ≤25 MW", "s-g3"],
    [S.bio, "Bio Power", "MNRE, MW, Bio Power Total", "s-g4"],
    [SOL.rooftop, "Solar, Rooftop (PM Surya Ghar)", "MNRE, MW", "s-acc"],
  ];
  const fV = (v) => gw(v) + " GW", fD = (v) => gw(v, 2) + " GW";
  return rows.map(([s, nm, sub, sw], i) => {
    const data = s.data.filter((d) => d.value != null);
    return `<tr><td class="name"><span class="sw ${sw}"></span>${nm}<small>${sub}</small></td><td class="val">${fV(data.at(-1).value)}</td><td class="chg">${arrow(data.at(-1).value - data.at(-2).value, fD)}, vs ${fmtMY(data.at(-2).date)}</td><td class="yr">${fV(data[0].value)}, ${fmtMY(data[0].date)}</td><td class="spark" id="sp-m${i}">${K.spark(gwPairs(s), { width: 150, height: 36 })}</td></tr>`;
  }).join("");
}

/* ============================ the plates ============================ */

/** § 03 the source mix: each source's share of the Grand Total, ranked, solar in the lead colour. */
export function comp() {
  const segs = compSegs();
  return figure({
    bare: true, file: "india-atlas_mnre_source-mix_2026-06",
    label: `Each source's share of India's installed renewable capacity, ${LATEST_SHORT}: solar ranked first`,
    data: { cols: ["source", "capacity_mw", "share_pct"], rows: segs.map((d) => [d.n, Math.round(d.v), +d.share.toFixed(1)]) },
    draw: (width) => K.bars({
      width, unit: { suffix: "%" }, dp: 1,
      rows: segs.map((d) => ({ name: d.n, value: d.share, highlight: d.n === "Solar Power", note: gw(d.v) + " GW" })),
    }),
  });
}

/** § 04 the Grand Total, broken at Dec 2023 where large hydro enters the count; the like-for-like
 * stock without large hydro carries on beside it in grey. */
export function total() {
  const P = gwPairs(S.grand_total), cut = "2023-12-01";
  const before = P.map(([d, v]) => [d, d < cut ? v : null]), after = P.map(([d, v]) => [d, d >= cut ? v : null]);
  const lh = S.large_hydro.data;
  const exHydro = S.grand_total.data.map((d, i) => [d.iso, d.iso >= "2023-11-01" && d.value != null ? (d.value - (lh[i].value ?? 0)) / 1000 : null]);
  return figure({
    bare: true, file: "india-atlas_mnre_grand-total_2020-2026",
    label: `Grand Total renewable capacity, All India, monthly Jan 2020 to ${LATEST_SHORT}, broken at December 2023 where large hydro was added to the count, with the total without large hydro beside it`,
    data: { cols: ["month", "grand_total_mw"], rows: S.grand_total.data.map((d) => [d.iso.slice(0, 7), d.value]) },
    draw: (width) => K.line({
      width, freq: "month", unit: GW, endDp: 1, hoverDp: 1,
      series: [
        { name: "Without large hydro", short: NB("No large hydro"), data: exHydro, role: "ctx" },
        { name: "Grand Total", data: before, role: "lead", label: false },
        { name: "Grand Total", short: NB("Grand Total"), data: after, role: "lead" },
      ],
      seam: { t: cut, before: "Large hydro not counted", after: "Large hydro counted" },
    }),
  });
}

const lineFig = ({ file, label, series, cols, rows, dp = 1 }) => figure({
  bare: true, file, label, data: { cols, rows },
  draw: (width) => K.line({ width, freq: "month", unit: GW, endDp: dp, hoverDp: dp, series }),
});

/** § 06 the four sources: solar the lead, the rest context. */
export function sources() {
  return lineFig({
    file: "india-atlas_mnre_sources_2020-2026",
    label: `Renewable capacity by source, All India, monthly Jan 2020 to ${LATEST_SHORT}: solar ${gw(last(S.solar))} GW, wind ${gw(last(S.wind))} GW, bio and small hydro nearly flat`,
    series: [
      { name: "Small Hydro", short: NB("Small Hydro"), data: gwPairs(S.small_hydro), role: "ctx2" },
      { name: "Bio", data: gwPairs(S.bio), role: "ctx2" },
      { name: "Wind", data: gwPairs(S.wind), role: "ctx" },
      { name: "Solar", data: gwPairs(S.solar), role: "lead" },
    ],
    cols: ["month", "solar_mw", "wind_mw", "bio_mw", "small_hydro_mw"],
    rows: S.solar.data.map((d, i) => [d.iso.slice(0, 7), d.value, S.wind.data[i].value, S.bio.data[i].value, S.small_hydro.data[i].value]),
  });
}

/** § 07 ground-mounted and rooftop solar. */
export function solar() {
  return lineFig({
    file: "india-atlas_mnre_solar-categories_2020-2026",
    label: `Solar capacity by sub-category, All India, monthly Jan 2020 to ${LATEST_SHORT}: ground mounted ${gw(last(SOL.ground_mounted))} GW, rooftop ${gw(last(SOL.rooftop))} GW`,
    series: [
      { name: "Rooftop (PM Surya Ghar)", short: "Rooftop", data: gwPairs(SOL.rooftop), role: "ctx" },
      { name: "Ground Mounted", short: NB("Ground mounted"), data: gwPairs(SOL.ground_mounted), role: "lead" },
    ],
    cols: ["month", "ground_mounted_mw", "rooftop_mw"],
    rows: SOL.ground_mounted.data.map((d, i) => [d.iso.slice(0, 7), d.value, SOL.rooftop.data[i].value]),
  });
}

/** § 08 the six largest states over time; the two leaders in the lead colour. */
export function sttime() {
  const t = topStates(), H = hydrate(stB);
  return figure({
    bare: true, file: "india-atlas_mnre_top-states-timeseries_2020-2026",
    label: `Grand Total renewable capacity, top six states, monthly Jan 2020 to ${LATEST_SHORT}: ${t[0].label} and ${t[1].label} lead`,
    data: { cols: ["month", ...t.map((d) => d.k)], rows: H[t[0].k].data.map((d, i) => [d.iso.slice(0, 7), ...t.map((x) => H[x.k].data[i].value)]) },
    draw: (width) => K.line({
      width, freq: "month", unit: GW, endDp: 0, hoverDp: 1,
      series: t.slice().reverse().map((d, j) => ({ name: d.label, short: NB(d.label), data: gwPairs(H[d.k]), role: j >= 4 ? "lead" : "ctx" })),
      events: [{ t: "2023-12-01", label: "Dec 2023: large hydro added", short: "Large hydro added" }],
    }),
  });
}

const stateFmt = (v) => (v < 0.95 ? Math.round(v * 1000).toLocaleString("en-IN") + " MW" : v.toFixed(1) + " GW");

/** § 08 solar by state above, Grand Total by state below: two rankings, one drawing. */
export function states() {
  const sol = solarEntries().filter((d) => d.v != null && d.v > 0).sort((a, b) => b.v - a.v);
  const tot = totalEntries().filter((d) => d.v != null && d.v > 0).sort((a, b) => b.v - a.v);
  const max = Math.max(sol[0].v, tot[0].v) / 1000; // both strips on one scale
  const strip = (rows, width) => K.bars({ width, max, unit: GW, fmt: stateFmt, rows: rows.map((r, i) => ({ name: r.state, value: r.v / 1000, highlight: i < 2 })) });
  return figure({
    bare: true, file: "india-atlas_mnre_state-solar-total_2026-06",
    label: `Solar capacity by state, then Grand Total renewable capacity by state, ${LATEST_SHORT}: ${sol[0].state} leads solar, ${tot[0].state} leads the total`,
    data: { cols: ["state", "solar_mw", "total_mw"], rows: tot.map((r) => { const s = sol.find((x) => x.state === r.state); return [r.state, s ? Math.round(s.v) : null, Math.round(r.v)]; }) },
    draw: (width) => K.panels([strip(sol, width), strip(tot, width)], { gap: 44, titles: ["Solar capacity", "Grand Total capacity, all sources"] }),
  });
}

/** § 09 each source's own map: the top eight states' shares of each source, four ranked panels. */
export function srcmap() {
  const all = srcShares(), TOP = 8;
  const short = (s) => ({ "Andaman and Nicobar Islands": "Andaman & Nicobar", "Jammu and Kashmir": "Jammu & Kashmir" })[s] || s;
  return figure({
    bare: true, file: "india-atlas_mnre_source-maps_" + LATEST_SHORT.replace(" ", "-").toLowerCase(),
    label: "State shares of each renewable source, " + LATEST_SHORT + ". " + SRC.map(([n]) => `${n}: ` + all[n].ent.slice(0, 3).map((d) => `${d.state} ${(d.last / all[n].tot * 100).toFixed(0)}%`).join(", ")).join(". "),
    data: { cols: ["source", "state", "installed_mw", "share_of_source_pct"], rows: SRC.flatMap(([n]) => all[n].ent.map((d) => [n, d.state, d.last, +(d.last / all[n].tot * 100).toFixed(2)])) },
    // two panels a row while each keeps 340 px, one a row on a phone: rows of panels, stacked
    draw: (width) => {
      const { across, w: pw, gap } = K.panelFit(width, 2, { gap: 32 }), cols = across ? 2 : 1;
      const max = Math.max(...SRC.map(([n]) => all[n].ent[0].last / all[n].tot * 100)); // one scale for the four panels
      const panel = ([n]) => K.bars({ width: pw, max, unit: { suffix: "%" }, dp: 0, fmt: (v) => v.toFixed(v < 1 ? 1 : 0) + "%",
        rows: all[n].ent.slice(0, TOP).map((d, i) => ({ name: short(d.state), value: d.last / all[n].tot * 100, highlight: i < 3 })) });
      const rows = []; for (let i = 0; i < SRC.length; i += cols) rows.push(SRC.slice(i, i + cols));
      return K.panels(rows.map((r) => K.panels(r.map(panel), { across, gap, titles: r.map(([n]) => n) })), { gap: 36 });
    },
  });
}

/** § 09 rooftop solar by state, top fifteen; the two leaders in the lead colour. */
export function rooftop() {
  const ent = rooftopEntries(), rows = ent.slice(0, 15);
  return figure({
    bare: true, file: "india-atlas_mnre_rooftop-by-state",
    label: "Rooftop solar capacity by state, " + LATEST_SHORT + ": " + rows.slice(0, 5).map((r) => `${r.state} ${gw(r.v, 2)} GW`).join(", "),
    data: { cols: ["state", "rooftop_mw"], rows: ent.map((d) => [d.state, d.v]) },
    draw: (width) => K.bars({ width, unit: GW, dp: 2, rows: rows.map((r, i) => ({ name: r.state, value: r.v / 1000, highlight: i < 2 })) }),
  });
}

/** § 10 bio power by kind: bagasse the lead. */
export function bio() {
  const KEYS = [["waste_to_energy", "Waste to energy, grid", "Grid waste"], ["waste_to_energy_off_grid", "Waste to energy, off-grid", "Off-grid waste"], ["non_bagasse", "Other biomass", "Other biomass"], ["bagasse", "Bagasse", "Bagasse"]];
  return lineFig({
    file: "india-atlas_mnre_bio-power-by-kind", dp: 2,
    label: `Bio-power capacity by kind, All India, monthly Jan 2020 to ${LATEST_SHORT}: bagasse cogeneration ${gw(last(BIO.bagasse), 2)} GW, the other three kinds far smaller`,
    series: KEYS.map(([k, name, sh]) => ({ name, short: NB(sh), data: gwPairs(BIO[k]), role: k === "bagasse" ? "lead" : k === "non_bagasse" ? "ctx" : "ctx2" })),
    cols: ["month", "bagasse_mw", "non_bagasse_mw", "waste_to_energy_off_grid_mw", "waste_to_energy_mw", "total_mw"],
    rows: BIO.total.data.map((d, i) => [d.iso.slice(0, 7), BIO.bagasse.data[i].value, BIO.non_bagasse.data[i].value, BIO.waste_to_energy_off_grid.data[i].value, BIO.waste_to_energy.data[i].value, d.value]),
  });
}
