// Public finance guide (government budgets and debt): the plates, drawn at build time with the
// chart kit (src/kit/), and every number the page quotes. Each plate export returns a bare figure for
// its .plotzone; titles, source lines and buttons stay in src/pages/guides/public-finance.astro.
//
// Data: data/series/public-finance-*.json (RBI DBIE via the Data Bank), read-only from other guides:
// states-finances, rates-borrowing, population-wpp-projection.
// Stages are never joined: accounts are lines; the revised estimate (filled, pale) and the budget
// estimate (hollow) are marks (the kit line's `stages`). GDP bases are never joined: each base is its
// own series, the rebasings marked; India Atlas's ratios over the NSO's 2011-12 back series are a
// separate dashed grey line, never a continuation of the RBI's.
import * as K from "../kit/kit.js";
import { figure } from "../kit/figure.js";
import { pairs } from "../kit/data.js";
import * as fmt from "../charts/format.js";
import cmB from "../../data/series/public-finance-centre-monthly.json";
import gmB from "../../data/series/public-finance-centre-gfd-monthly.json";
import pathB from "../../data/series/public-finance-centre-budget-path.json";
import cdB from "../../data/series/public-finance-centre-deficits.json";
import ceB from "../../data/series/public-finance-centre-expenditure.json";
import crB from "../../data/series/public-finance-centre-receipts.json";
import cfB from "../../data/series/public-finance-centre-financing.json";
import g99B from "../../data/series/public-finance-centre-gdp-b1999.json";
import g04B from "../../data/series/public-finance-centre-gdp-b2004.json";
import g11B from "../../data/series/public-finance-centre-gdp-b2011.json";
import sg11B from "../../data/series/public-finance-allstates-gdp-b2011.json";
import sg99B from "../../data/series/public-finance-allstates-gdp-b1999.json";
import sg04B from "../../data/series/public-finance-allstates-gdp-b2004.json";
import dg99B from "../../data/series/public-finance-combined-debt-gdp-b1999.json";
import dg04B from "../../data/series/public-finance-combined-debt-gdp-b2004.json";
import dg11B from "../../data/series/public-finance-combined-debt-gdp-b2011.json";
import backB from "../../data/series/public-finance-ratios-backcast.json";
import r22B from "../../data/series/public-finance-ratios-2022.json";
import sdB from "../../data/series/public-finance-allstates-deficits.json";
import srxB from "../../data/series/public-finance-allstates-receipts.json";
import sxB from "../../data/series/public-finance-allstates-expenditure.json";
import ctaxB from "../../data/series/public-finance-combined-taxes.json";
import ownB from "../../data/series/public-finance-ownership-gsec.json";
import tbB from "../../data/series/public-finance-tbills.json";
import matB from "../../data/series/public-finance-maturity.json";
import ssB from "../../data/series/public-finance-small-savings.json";
import ssrB from "../../data/series/public-finance-small-savings-rates.json";
import wmaB from "../../data/series/public-finance-states-wma.json";
import sfinB from "../../data/series/states-finances.json";
import borrowB from "../../data/series/rates-borrowing.json";
import popB from "../../data/series/population-wpp-projection.json";

const PCT = { suffix: "%" }, LCR = { prefix: "₹", suffix: " lakh cr" };
const ML = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const MS = ML.map((m) => m.slice(0, 3));
const fyOf = (iso) => { const y = +iso.slice(0, 4), m = +iso.slice(5, 7), s = m >= 4 ? y : y - 1; return `${s}-${String((s + 1) % 100).padStart(2, "0")}`; };
const monthOf = (iso) => MS[+iso.slice(5, 7) - 1] + " " + iso.slice(0, 4);
const dayOf = (iso) => `${+iso.slice(8, 10)} ${MS[+iso.slice(5, 7) - 1]} ${iso.slice(0, 4)}`;
const pc = (u) => `<span class="pc">${u}</span>`;
const p1 = fmt.pct1;
const lc = (v) => "₹" + (v / 1e5).toFixed(1) + " lakh crore";
const rs = (v) => "₹" + v.toFixed(0);
const lastOf = (b, k) => { const d = b.series[k]?.data ?? []; for (let i = d.length - 1; i >= 0; i--) if (d[i] != null) return { v: d[i], i, date: b.dates[i] }; return null; };
const firstOf = (b, k) => { const d = b.series[k]?.data ?? []; const i = d.findIndex((v) => v != null); return i < 0 ? null : { v: d[i], i, date: b.dates[i] }; };
const atFY = (b, k, fy) => { const i = b.dates.indexOf(`${fy.slice(0, 4)}-04-01`); return i < 0 ? null : b.series[k]?.data[i] ?? null; };
const ST = cdB.meta.stages, SS = sdB.meta.stages;
const cut = (P, toIso) => P.filter(([d]) => d <= toIso);
const nn = (P) => P.filter((p) => p[1] != null);

// one table for the CSV: a row per date, a column per series
const csvOf = (cols, series) => {
  const dates = [...new Set(series.flatMap((s) => s.map((p) => p[0])))].sort();
  const at = series.map((s) => new Map(s.filter((p) => p[1] != null)));
  return { cols, rows: dates.map((d) => [d, ...at.map((m) => m.get(d) ?? null)]) };
};
// the revised and budget estimates of one series, as the kit's stage marks
const stagesOf = (b, k) => [["re", `${k}__re`], ["be", `${k}__be`]].map(([kind, key]) => { const o = firstOf(b, key); return o ? [o.date, o.v, kind] : null; }).filter(Boolean);
// a share of a total, per date (rupee amounts: no rounding before the division)
const shareOf = (b, k, totK, axis = b.dates) => axis.map((d) => { const i = b.dates.indexOf(d); const t = b.series[totK].data[i], v = b.series[k]?.data[i]; return [d, t && v != null ? 100 * v / t : null]; });
const stageShare = (b, k, totK) => ["re", "be"].map((kind) => { const v = firstOf(b, `${k}__${kind}`), g = firstOf(b, `${totK}__${kind}`); return v && g ? [v.date, 100 * v.v / g.v, kind] : null; }).filter(Boolean);
const rebased = (b04, b11) => [{ t: b04.dates[0], label: "GDP rebased: 2004-05", short: "2004-05 base" }, { t: b11.dates[0], label: "2011-12", short: "2011-12" }];

/* ---------- § 04 the deficit, Centre and states, every GDP ruler apart ---------- */
// rbi: [{ name, short, role, rulers:[bundle x3], key, stages }]; atlas: [{ name, data }]
function rulerPlate({ file, label, rbi, atlas, events, unitEnd = 1 }) {
  const series = [];
  for (const a of atlas) series.push({ name: a.name, data: pairs(backB, a.key), role: "ctx", dash: "5 3", label: false });
  for (const r of rbi) r.rulers.forEach((b, i, all) => series.push({
    name: `${r.name}, RBI, ${["1999-2000", "2004-05", "2011-12"][i]} base`, short: r.short, data: pairs(b, r.key), role: r.role,
    label: i === all.length - 1, ...(i === all.length - 1 ? { stages: r.stages } : {}) }));
  const csv = csvOf(["Financial year (from April)", ...series.map((s) => s.name)], series.map((s) => [...s.data, ...(s.stages ?? []).map(([d, v]) => [d, v])]));
  return figure({
    bare: true, file, label, data: csv,
    draw: (width) => K.line({ width, freq: "fy", unit: PCT, endDp: unitEnd, series: series.slice().sort((a, b) => (a.role === "lead") - (b.role === "lead")), events }),
  });
}
export function deficit() {
  return rulerPlate({
    file: "public-finance-deficit",
    label: `Gross fiscal deficit of the Centre and all states as a share of GDP since ${fyOf(backB.dates[0])}, the RBI's ratios on each GDP base never joined, India Atlas's ratios over the NSO back series dashed`,
    rbi: [
      { name: "States", short: "States", role: "comp", key: "gross_fiscal_deficit", rulers: [sg99B, sg04B, sg11B], stages: stagesOf(sg11B, "gross_fiscal_deficit") },
      { name: "Centre", short: "Centre", role: "lead", key: "gross_fiscal_deficit", rulers: [g99B, g04B, g11B], stages: stagesOf(g11B, "gross_fiscal_deficit") },
    ],
    atlas: [{ name: "Centre, India Atlas computed", key: "centre_gross_fiscal_deficit" }, { name: "States, India Atlas computed", key: "states_gross_fiscal_deficit" }],
    events: rebased(g04B, g11B),
  });
}

/* ---------- § 04 this year so far, against the budget ---------- */
const ytd = lastOf(cmB, "fiscal_deficit_pct_be"), ytdInr = lastOf(cmB, "fiscal_deficit");
const ytdAgo = cmB.series.fiscal_deficit_pct_be.data[ytd.i - 12];
const lastMonth = ML[+ytd.date.slice(5, 7) - 1];
export function ytdPlate() {
  const curFY = fyOf(ytd.date);
  const fys = []; for (let k = 5; k >= 0; k--) { const y = +curFY.slice(0, 4) - k; fys.push(`${y}-${String((y + 1) % 100).padStart(2, "0")}`); }
  // every year on one April-to-March axis (a stand-in calendar, 2000-01), so months line up
  const onAxis = (d) => { const m = +d.slice(5, 7); return `${m >= 4 ? 2000 : 2001}-${d.slice(5, 7)}-01`; };
  const rows = fys.map((fy) => ({ fy, data: cmB.dates.map((d, i) => [d, cmB.series.fiscal_deficit_pct_be.data[i]]).filter(([d]) => fyOf(d) === fy).map(([d, v]) => [onAxis(d), v]) }));
  const cur = rows.at(-1), lastP = nn(cur.data).at(-1);
  const months = ["04", "05", "06", "07", "08", "09", "10", "11", "12", "01", "02", "03"];
  return figure({
    bare: true, file: "public-finance-deficit-so-far",
    label: `The Centre's fiscal deficit from April to each month as a share of the year's budget estimate, ${curFY} against the five years before it`,
    data: { cols: ["Financial year", "Month", "Fiscal deficit, % of the year's budget estimate"], rows: rows.flatMap((r) => nn(r.data).map(([d, v]) => [r.fy, MS[+d.slice(5, 7) - 1], v])) },
    draw: (width) => K.line({
      width, unit: PCT, endDp: 1, tDomain: [K.tnum("2000-04-01"), K.tnum("2001-03-01")],
      xTicks: months.filter((_, i) => width >= 520 || i % 3 === 0).map((m) => ({ t: `${+m >= 4 ? 2000 : 2001}-${m}-01`, label: MS[+m - 1] })),
      refs: [{ y: 100, label: "The whole year's budgeted deficit" }],
      series: [
        ...rows.slice(0, -1).map((r) => ({ name: r.fy, short: r.fy, data: r.data, role: "ctx2", hover: false })),
        { name: cur.fy, short: cur.fy, data: cur.data, role: "lead", label: false, hover: false },
      ],
      notes: [{ d: lastP[0], v: lastP[1], text: `${cur.fy}, April to ${lastMonth}\n${p1(lastP[1])} of the budget`, side: "left", dy: 44 }],
    }),
  });
}

/* ---------- § 04 budget, revised, accounts: every year ---------- */
export function path() {
  const k = "fiscal_deficit", L = (s) => pairs(pathB, `${k}__${s}`).map(([d, v]) => [d, v == null ? null : v / 1e5]);
  return figure({
    bare: true, file: "public-finance-budget-path",
    label: "The Centre's fiscal deficit each year as budgeted, as revised and as the provisional accounts closed it, ₹ lakh crore",
    data: { cols: ["Financial year (from April)", "Budget estimate, ₹ crore", "Revised estimate, ₹ crore", "Provisional accounts, ₹ crore"], rows: pathB.dates.map((d, i) => [d, pathB.series[k + "__be"].data[i], pathB.series[k + "__re"].data[i], pathB.series[k + "__provisional"].data[i]]) },
    draw: (width) => K.line({
      width, freq: "fy", unit: LCR, endDp: 1, hoverDp: 2,
      series: [
        { name: "Revised estimate", short: "Revised", data: L("re"), role: "ctx" },
        { name: "Budget estimate", short: "Budget", data: L("be"), role: "comp" },
        { name: "Provisional accounts", short: "Accounts", data: L("provisional"), role: "lead" },
      ],
    }),
  });
}

/* ---------- § 04 how the deficit is paid for ---------- */
export function financing() {
  const b = cfB, G = "gross_fiscal_deficit";
  const L = [["drawdown_of_cash_balances", "Cash", "Drawdown of cash", "ctx2"], ["external_finance", "External finance", "External", "ctx2"], ["other_borrowings", "Other borrowing", "Other", "ctx"], ["market_borrowings", "Market borrowing", "Market", "lead"]];
  const series = L.map(([k, name, short, role]) => ({ name, short: name, data: shareOf(b, k, G), stages: stageShare(b, k, G), role }));
  return figure({
    bare: true, file: "public-finance-financing",
    label: "How the Centre's gross fiscal deficit is financed, per cent of the deficit: market borrowing, other borrowing, external finance and cash",
    data: csvOf(["Financial year (from April)", ...series.map((s) => s.name + ", % of the deficit")], series.map((s) => [...s.data, ...s.stages.map(([d, v]) => [d, v])])),
    draw: (width) => K.line({ width, freq: "fy", unit: PCT, endDp: 0, series }),
  });
}

/* ---------- § 05 the Centre's taxes ---------- */
const taxAxis = crB.dates.filter((d) => d <= `${ST.accountsTo.slice(0, 4)}-04-01`);
const TAXES = [["customs_duties", "Customs", "ctx2"], ["excise_duties", "Excise", "ctx2"], ["gst", "GST", "ctx"], ["corporation_tax", "Corporation tax", "comp"], ["personal_income_tax", "Income tax", "lead"]];
const taxShare = (k) => shareOf(crB, k, "tax_revenue_net", taxAxis);
export function taxmix() {
  const series = TAXES.map(([k, name, role]) => ({ name, short: name, data: taxShare(k), role }));
  return figure({
    bare: true, file: "public-finance-centre-taxes",
    label: "Each tax's share of the Centre's net tax revenue, per cent, accounts",
    data: csvOf(["Financial year (from April)", ...series.map((s) => s.name + ", % of net tax revenue")], series.map((s) => s.data)),
    draw: (width) => K.line({ width, freq: "fy", unit: PCT, endDp: 0, series, events: [{ t: "2017-04-01", label: "GST, July 2017", short: "GST" }] }),
  });
}
export function taxgdp() {
  const R = [g99B, g04B, g11B], base = ["1999-2000", "2004-05", "2011-12"];
  const mk = (k, name, role) => R.map((b, i) => ({ name: `${name}, ${base[i]} base`, short: name, data: pairs(b, k), role, label: i === 2, ...(i === 2 ? { stages: stagesOf(g11B, k) } : {}) }));
  const series = [...mk("gross_indirect_tax", "Indirect", "ctx"), ...mk("gross_direct_tax", "Direct", "lead")];
  return figure({
    bare: true, file: "public-finance-taxes-gdp",
    label: "The Centre's gross direct and indirect taxes as a share of GDP on three GDP series, never joined",
    data: csvOf(["Financial year (from April)", ...series.map((s) => s.name + ", % of GDP")], series.map((s) => [...s.data, ...(s.stages ?? []).map(([d, v]) => [d, v])])),
    draw: (width) => K.line({ width, freq: "fy", unit: PCT, endDp: 1, series, events: rebased(g04B, g11B) }),
  });
}
export function taxwho() {
  const b = ctaxB, data = b.dates.map((d, i) => { const c = b.series.centre_total.data[i], s = b.series.states_total.data[i]; return [d, c != null && s != null ? 100 * s / (c + s) : null]; });
  return figure({
    bare: true, file: "public-finance-who-collects",
    label: "The states' share of all taxes collected by India's governments, per cent",
    data: { cols: ["Financial year (from April)", "Centre's gross taxes, ₹ crore", "States' own taxes, ₹ crore", "States' share, %"], rows: b.dates.map((d, i) => [d, b.series.centre_total.data[i], b.series.states_total.data[i], data[i][1]]) },
    draw: (width) => K.line({ width, freq: "fy", unit: PCT, endDp: 1, series: [{ name: "States' share", short: "States", data, role: "lead" }] }),
  });
}

/* ---------- § 06 every ₹100 the Centre spends ---------- */
const spendParts = (get) => {
  const te = get("total_expenditure"), int = get("interest_payments"), dr = get("defence_revenue"), dc = get("defence_capital"), sub = get("subsidies"), re = get("revenue_expenditure"), co = get("capital_outlay"), la = get("loans_and_advances");
  return [["Interest", int], ["Defence", dr + dc], ["Subsidies", sub], ["Other day-to-day spending", re - int - dr - sub], ["Capital outlay", co - dc], ["Loans", la]].map(([k, v]) => ({ k, v: 100 * v / te }));
};
export function spend() {
  const years = [["2004-05", (k) => atFY(ceB, k, "2004-05")], [ST.accountsTo, (k) => atFY(ceB, k, ST.accountsTo)], [`${ST.budgetEstimate} budget`, (k) => firstOf(ceB, k + "__be").v]];
  const rows = years.map(([name, get]) => ({ name, parts: spendParts(get).map((p) => p.v) }));
  const C = K.C;
  const parts = [{ name: "Interest", color: C.lead }, { name: "Defence", color: C.leadTint, ink: true }, { name: "Subsidies", color: C.compTint, ink: true },
    { name: "Other day-to-day spending", color: C.grid, ink: true }, { name: "Capital outlay", color: C.teal }, { name: "Loans", color: C.ctx, ink: true }];
  return figure({
    bare: true, file: "public-finance-every-100-rupees",
    label: "Every ₹100 the Centre spends, by head: interest, defence, subsidies, other day-to-day spending, capital outlay and loans, for 2004-05, the latest accounts and the budget",
    data: { cols: ["Year", ...parts.map((p) => p.name + ", per ₹100")], rows: rows.map((r) => [r.name, ...r.parts.map((v) => +v.toFixed(2))]) },
    draw: (width) => K.stackBars({ width, parts, rows, sort: false, labels: "all" }),
  });
}
export function interest() {
  const ratio = (eb, ek, rb, rk) => eb.dates.map((d, i) => { const j = rb.dates.indexOf(d); const e = eb.series[ek].data[i], r = j < 0 ? null : rb.series[rk].data[j]; return [d, e != null && r ? 100 * e / r : null]; });
  const stage = (eb, ek, rb, rk) => ["re", "be"].map((kind) => { const e = firstOf(eb, `${ek}__${kind}`), r = firstOf(rb, `${rk}__${kind}`); return e && r ? [e.date, 100 * e.v / r.v, kind] : null; }).filter(Boolean);
  const series = [
    { name: "All states", short: "States", data: ratio(sxB, "interest_payments", srxB, "total_revenue_receipts"), stages: stage(sxB, "interest_payments", srxB, "total_revenue_receipts"), role: "comp" },
    { name: "Centre", short: "Centre", data: ratio(ceB, "interest_payments", crB, "revenue_receipts"), stages: stage(ceB, "interest_payments", crB, "revenue_receipts"), role: "lead" },
  ];
  return figure({
    bare: true, file: "public-finance-interest-burden",
    label: "Interest payments per ₹100 of revenue receipts, the Centre and all states",
    data: csvOf(["Financial year (from April)", "Centre, interest per ₹100 of revenue", "States, interest per ₹100 of revenue"], [[...series[1].data, ...series[1].stages.map(([d, v]) => [d, v])], [...series[0].data, ...series[0].stages.map(([d, v]) => [d, v])]]),
    draw: (width) => K.line({ width, freq: "fy", unit: { prefix: "₹" }, endDp: 0, hoverDp: 1, series }),
  });
}
export function capex() {
  const series = [
    { name: "Interest", short: "Interest", data: pairs(g11B, "interest_payments"), stages: stagesOf(g11B, "interest_payments"), role: "ctx" },
    { name: "Capital spending", short: "Capital spending", data: pairs(g11B, "capital_expenditure"), stages: stagesOf(g11B, "capital_expenditure"), role: "lead" },
  ];
  return figure({
    bare: true, file: "public-finance-capital-and-interest",
    label: "The Centre's capital expenditure and interest payments as a share of GDP, 2011-12 base",
    data: csvOf(["Financial year (from April)", "Capital expenditure, % of GDP", "Interest payments, % of GDP"], [[...series[1].data, ...series[1].stages.map(([d, v]) => [d, v])], [...series[0].data, ...series[0].stages.map(([d, v]) => [d, v])]]),
    draw: (width) => K.line({ width, freq: "fy", unit: PCT, endDp: 1, series }),
  });
}

/* ---------- § 07 debt ---------- */
const DK = { comb: "combined_total_liabilities_of_centre_and_states", cen: "total_liabilities_of_the_centre", sta: "total_liabilities_of_the_states" };
export function debt() {
  return rulerPlate({
    file: "public-finance-debt",
    label: "Outstanding liabilities of the Centre, all states and the two together as a share of GDP, the RBI's ratios on each GDP base never joined, India Atlas's ratios over the NSO back series dashed",
    rbi: [
      { name: "States", short: "States", role: "ctx2", key: DK.sta, rulers: [dg99B, dg04B, dg11B], stages: stagesOf(dg11B, DK.sta) },
      { name: "Centre", short: "Centre", role: "ctx", key: DK.cen, rulers: [dg99B, dg04B, dg11B], stages: stagesOf(dg11B, DK.cen) },
      { name: "Centre and states", short: "Combined", role: "lead", key: DK.comb, rulers: [dg99B, dg04B, dg11B], stages: stagesOf(dg11B, DK.comb) },
    ],
    atlas: [{ name: "Centre and states, India Atlas computed", key: "combined_liabilities" }, { name: "Centre, India Atlas computed", key: "centre_liabilities" }, { name: "States, India Atlas computed", key: "states_liabilities" }],
    events: rebased(dg04B, dg11B),
  });
}
export function holders() {
  const H = [["mutual_funds", "Mutual funds", "ctx2"], ["foreign_portfolio_investors", "Foreign investors", "ctx2"], ["pension_funds", "Pension funds", "ctx2"], ["provident_funds", "Provident funds", "ctx2"], ["rbi", "RBI", "ctx"], ["insurance_companies", "Insurers", "comp"], ["commercial_banks", "Banks", "lead"]];
  const series = (width) => H.map(([k, name, role]) => ({ name, short: name, data: pairs(ownB, k), role, label: width >= 520 || role !== "ctx2" }));
  return figure({
    bare: true, file: "public-finance-who-holds-the-debt",
    label: "Who holds the Centre's dated securities, per cent of the total outstanding at each quarter-end",
    draw: (width) => K.line({ width, freq: "month", unit: PCT, endDp: 1, height: width >= 520 ? 460 : undefined, series: series(width) }),
  });
}
export function tbills() {
  const L = (k) => pairs(tbB, k).map(([d, v]) => [d, v == null ? null : v / 1e5]);
  const series = [["cmb__total", "Cash management", "ctx2"], ["t91__total", "91-day", "ctx"], ["t182__total", "182-day", "comp"], ["t364__total", "364-day", "lead"]]
    .map(([k, name, role]) => ({ name, short: name, data: L(k), role, label: lastOf(tbB, k)?.i === tbB.dates.length - 1 }));
  return figure({
    bare: true, file: "public-finance-treasury-bills",
    label: "Treasury bills outstanding by tenor, every Friday, ₹ lakh crore",
    draw: (width) => K.line({ width, freq: "month", unit: LCR, endDp: 1, hoverDp: 2, series }),
  });
}
export function maturity() {
  const b = matB, sh = (k) => b.dates.map((d, i) => [d, b.series.total_amount.data[i] ? 100 * (b.series[k].data[i] ?? 0) / b.series.total_amount.data[i] : null]);
  const series = [["under_5_years", "Within 5 years", "Under 5 years", "ctx2"], ["between_5_and_10_years", "5 to 10 years", "5–10 years", "ctx"], ["over_10_years", "After 10 years", "10+ years", "lead"]].map(([k, name, short, role]) => ({ name, short, data: sh(k), role }));
  return figure({
    bare: true, file: "public-finance-maturity",
    label: "The Centre's dated securities by years left to maturity, per cent of the total outstanding at each March",
    data: csvOf(["Financial year (end-March of)", ...series.map((s) => s.name + ", %")], series.map((s) => s.data)),
    draw: (width) => K.line({ width, freq: "fy", unit: PCT, endDp: 0, series }),
  });
}
// the six largest schemes still reporting, by their latest balance
const SCHEMES = (() => {
  const b = ssB, lastV = (k) => lastOf(b, k)?.v ?? 0;
  return Object.keys(b.series).filter((k) => k.endsWith("__outstanding") && !/^(total|total_deposits|total_certificates)__/.test(k))
    .filter((k) => lastOf(b, k)?.date === b.dates.at(-1)).sort((a, c) => lastV(c) - lastV(a)).slice(0, 6);
})();
const schemeName = (k) => ssB.series[k].label.split(":")[0];
const SHORT_SCHEME = { "Post Office Time Deposits": "Time deposits", "Monthly Income Scheme": "Monthly income", "Kisan Vikas Patras - 2014": "Kisan Vikas Patra", "Senior Citizen Scheme 2004": "Senior citizens", "Post Office Savings Bank Deposits": "Savings deposits", "Sukanya Samriddhi Yojana": "Sukanya Samriddhi", "Public Provident Fund": "PPF", "National Savings Certificates": "NSC" };
export function savings() {
  const L = (k) => pairs(ssB, k).map(([d, v]) => [d, v == null ? null : v / 1e5]);
  // a phone labels the total only; the schemes stay as grey context, named on hover
  const series = (width) => [...SCHEMES.map((k) => ({ name: schemeName(k), short: SHORT_SCHEME[schemeName(k)] ?? schemeName(k), data: L(k), role: "ctx2", label: width >= 520 })),
    { name: "All schemes", short: "All schemes", data: L("total__outstanding"), role: "lead" }];
  return figure({
    bare: true, file: "public-finance-small-savings",
    label: "Small savings outstanding at each month's end, all schemes and the six largest, ₹ lakh crore",
    draw: (width) => K.line({ width, freq: "month", unit: LCR, endDp: 1, hoverDp: 2, height: width >= 520 ? 460 : undefined, series: series(width) }),
  });
}

/* ---------- § 08 the states ---------- */
const stAxis = (b) => b.dates.filter((d) => d <= `${SS.accountsTo.slice(0, 4)}-04-01`);
// the RBI's "tax receipts" include the states' share in central taxes, and its "non-tax receipts"
// include grants from the Centre; own taxes and own non-tax revenue are the totals less the transfers
const recVal = (k, i) => {
  const g = (x) => srxB.series[x]?.data[i];
  if (k === "own_taxes") return g("tax_receipts") == null || g("share_in_central_taxes") == null ? null : g("tax_receipts") - g("share_in_central_taxes");
  if (k === "own_non_tax") return g("non_tax_receipts") == null || g("grants_from_the_centre") == null ? null : g("non_tax_receipts") - g("grants_from_the_centre");
  return g(k);
};
const recShare = (k) => stAxis(srxB).map((d) => { const i = srxB.dates.indexOf(d); const t = srxB.series.total_revenue_receipts.data[i], v = recVal(k, i); return [d, t && v != null ? 100 * v / t : null]; });
const REC = [["own_non_tax", "Own non-tax revenue", "Non-tax revenue", "ctx2"], ["grants_from_the_centre", "Grants from the Centre", "Grants", "ctx"], ["share_in_central_taxes", "Share in central taxes", "Central tax share", "comp"], ["own_taxes", "Own taxes", "Own taxes", "lead"]];
export function stReceipts() {
  const series = REC.map(([k, name, short, role]) => ({ name, short, data: recShare(k), role }));
  return figure({
    bare: true, file: "public-finance-states-revenue",
    label: "All states' revenue receipts by source, per cent of the total: own taxes, share in central taxes, grants from the Centre and own non-tax revenue",
    data: csvOf(["Financial year (from April)", ...series.map((s) => s.name + ", %")], series.map((s) => s.data)),
    draw: (width) => K.line({ width, freq: "fy", unit: PCT, endDp: 0, series }),
  });
}
const SPEND = [["capital_outlay", "Capital outlay", "Capital outlay", "ctx2"], ["pension_and_misc_general_services", "Pensions and general services", "Pensions etc.", "ctx2"], ["interest_payments", "Interest", "Interest", "ctx"], ["economic_services", "Economic services", "Economic", "comp"], ["social_services", "Social services", "Social", "lead"]];
const spShare = (k) => shareOf(sxB, k, "total_expenditure", stAxis(sxB));
export function stSpend() {
  const series = SPEND.map(([k, name, short, role]) => ({ name, short, data: spShare(k), role }));
  return figure({
    bare: true, file: "public-finance-states-spending",
    label: "All states' expenditure by head, per cent of total expenditure",
    data: csvOf(["Financial year (from April)", ...series.map((s) => s.name + ", %")], series.map((s) => s.data)),
    draw: (width) => K.line({ width, freq: "fy", unit: PCT, endDp: 0, series }),
  });
}
const sfI = sfinB.dates.length - 1;
const stateRows = Object.entries(sfinB.series).filter(([k]) => k.endsWith("__debt"))
  .map(([k, s]) => ({ state: s.label.split(":")[0], debt: s.data[sfI], gfd: sfinB.series[k.replace(/__debt$/, "__gfd")]?.data[sfI] ?? null }))
  .filter((r) => r.debt != null).sort((a, c) => c.debt - a.debt);
export function stateCut() {
  return figure({
    bare: true, file: "public-finance-states-debt",
    label: `Each state's outstanding liabilities and gross fiscal deficit as a share of its GSDP, ${fyOf(sfinB.dates[sfI])}`,
    data: { cols: ["State", "Financial year", "Debt, % of GSDP", "Gross fiscal deficit, % of GSDP"], rows: stateRows.map((r) => [r.state, fyOf(sfinB.dates[sfI]), r.debt, r.gfd]) },
    draw: (width) => K.dumbbell({ width, rows: stateRows.map((r) => ({ name: r.state, a: r.gfd, b: r.debt })), keys: { a: "Fiscal deficit", b: "Debt" }, unit: PCT, dp: 1, sortBy: "b" }),
  });
}
// states' days on the RBI's facilities, last twelve months
const wmaN = wmaB.dates.length, wmaFrom = wmaN - 12;
const wmaRows = (() => {
  const states = wmaB.meta.states.map((s) => ({ s, k: s.toLowerCase().normalize("NFKD").replace(/&/g, " and ").replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "") }));
  const sum = (k) => (wmaB.series[k]?.data.slice(wmaFrom) ?? []).reduce((a, v) => a + (v ?? 0), 0);
  return states.map(({ s, k }) => ({ state: s, sdf: sum(`${k}__sdf_days`), wma: sum(`${k}__wma_days`), od: sum(`${k}__od_days`) })).filter((r) => r.sdf + r.wma + r.od > 0).sort((a, c) => c.od - a.od || (c.wma + c.sdf) - (a.wma + a.sdf));
})();
export function wma() {
  const C = K.C;
  return figure({
    bare: true, file: "public-finance-states-cash",
    label: "Days each state drew on the RBI's overdraft, ways and means advances and special drawing facility over the last twelve months",
    data: { cols: ["State", "Overdraft days", "Ways and means days", "Special drawing facility days", "Period"], rows: wmaRows.map((r) => [r.state, r.od, r.wma, r.sdf, `${wmaB.dates[wmaFrom].slice(0, 7)} to ${wmaB.dates.at(-1).slice(0, 7)}`]) },
    draw: (width) => K.stackBars({
      width, sort: false, absolute: { unit: { suffix: " days" }, dp: 0, fmt: (v) => `${v} ${v === 1 ? "day" : "days"}` },
      parts: [{ name: "Overdraft", color: C.lead }, { name: "Ways and means advances", color: C.ctx }, { name: "Special drawing facility", color: C.ctx2 }],
      rows: wmaRows.map((r) => ({ name: r.state, parts: [r.od, r.wma, r.sdf], note: r.od ? `${r.od} in overdraft` : undefined })),
    }),
  });
}

/* ---------- § 09 which GDP ---------- */
export function gdpbase() {
  const acc = `${ST.accountsTo.slice(0, 4)}-04-01`, base = ["1999-2000", "2004-05", "2011-12"];
  const pub = [g99B, g04B, g11B].map((b, i) => ({ name: `RBI, ${base[i]} base`, short: "RBI 2011-12 series", data: cut(pairs(b, "gross_fiscal_deficit"), acc), role: "ctx", label: i === 2 }));
  const series = [...pub,
    { name: "Over the 2011-12 back series, India Atlas", short: "2011-12 back series", data: pairs(backB, "centre_gross_fiscal_deficit"), role: "ctx", color: K.C.leadSoft, dash: "5 3", label: false },
    { name: "Over the 2022-23 series, India Atlas", short: "2022-23 series", data: cut(pairs(r22B, "centre_gross_fiscal_deficit"), acc), role: "lead", dash: "5 3" }];
  return figure({
    bare: true, file: "public-finance-which-gdp",
    label: "The Centre's gross fiscal deficit as a share of GDP: as the RBI publishes it on the GDP of each period, and computed over the 2011-12 back series and the new 2022-23 series",
    data: csvOf(["Financial year (from April)", ...series.map((s) => s.name)], series.map((s) => s.data)),
    draw: (width) => K.line({ width, freq: "fy", unit: PCT, endDp: 1, series, events: rebased(g04B, g11B) }),
  });
}

/* ---------- every number the page quotes, as the old client set it ---------- */
export function numbers() {
  const N = {};
  // title block and § 01
  N["n-ytd"] = ytd.v.toFixed(1) + pc("%");
  N["d-ytd"] = `<b>${p1(ytdAgo)}</b> a year earlier, April to ${lastMonth}`;
  N["nspark-ytd"] = K.spark(gmB.dates.map((d, i) => [d, gmB.series.gfd_fytd.data[i]]).slice(-87), { width: 190, height: 44 });
  const gfdBE = firstOf(g11B, "gross_fiscal_deficit__be").v, gfdRE = firstOf(g11B, "gross_fiscal_deficit__re").v;
  N["n-gfd"] = gfdBE.toFixed(1) + pc("% of GDP");
  N["d-gfd"] = `<b>${p1(gfdRE)}</b> revised estimate, ${ST.revisedEstimate}`;
  const intRRbe = 100 * firstOf(ceB, "interest_payments__be").v / firstOf(crB, "revenue_receipts__be").v;
  const intRRacc = 100 * atFY(ceB, "interest_payments", ST.accountsTo) / atFY(crB, "revenue_receipts", ST.accountsTo);
  N["n-int"] = "₹" + intRRbe.toFixed(1);
  N["d-int"] = `budget ${ST.budgetEstimate}; <b>₹${intRRacc.toFixed(1)}</b> in the accounts for ${ST.accountsTo}`;
  const debtBE = firstOf(dg11B, DK.comb + "__be").v, debtAcc = lastOf(dg11B, DK.comb);
  N["n-debt"] = debtBE.toFixed(1) + pc("%");
  N["d-debt"] = `budgets for ${SS.budgetEstimate}; <b>${p1(debtAcc.v)}</b> in ${fyOf(debtAcc.date)} accounts`;
  N["rb-ytd"] = ytd.v.toFixed(1) + pc("%");
  N["rb-ytd-inr"] = lc(ytdInr.v);
  N["prov-vintage"] = cmB.meta.vintage;
  N["prov-vintage2"] = cmB.meta.vintage;
  // § 02 lived reality
  const te = firstOf(ceB, "total_expenditure__be").v, per100 = (k) => 100 * firstOf(ceB, k + "__be").v / te;
  const pop = (() => { const y = +ST.budgetEstimate.slice(0, 4); const i = popB.dates.indexOf(`${y}-01-01`); return i < 0 ? null : popB.series.tpopulation1july.data[i] * 1000; })();
  N["lr-te"] = lc(te);
  N["lr-pp"] = pop ? "₹" + fmt.inr(Math.round(te * 1e7 / pop / 100) * 100) : "–";
  N["lr-int"] = rs(per100("interest_payments"));
  N["lr-def"] = rs(per100("defence_revenue") + per100("defence_capital"));
  N["lr-sub"] = rs(per100("subsidies"));
  N["lr-cap"] = rs(per100("capital_outlay"));
  const ssl = lastOf(ssB, "total__outstanding");
  N["lr-ss"] = lc(ssl.v);
  N["lr-ss-when"] = monthOf(ssl.date);
  const ppf = lastOf(ssrB, "public_provident_fund_1968"), ssy = lastOf(ssrB, "sukanya_samriddhi_accounts");
  N["lr-ppf"] = p1(ppf.v);
  N["lr-ssy"] = p1(ssy.v);
  N["lr-rate-when"] = dayOf(ppf.date);
  // § 04 deficit
  const sSt = stagesOf(sg11B, "gross_fiscal_deficit");
  N["pv-deficit"] = p1(gfdBE);
  N["ex-def-acc"] = p1(atFY(g11B, "gross_fiscal_deficit", ST.accountsTo));
  N["ex-def-re"] = p1(gfdRE);
  N["ex-def-be"] = p1(gfdBE);
  N["ex-def-st"] = p1(sSt.find((p) => p[2] === "be")[1]);
  // this year so far
  N["pv-ytd"] = p1(ytd.v);
  N["ex-ytd-inr"] = lc(ytdInr.v);
  N["ex-ytd-pct"] = p1(ytd.v);
  N["ex-ytd-ago"] = p1(ytdAgo);
  N["ex-ytd-tax"] = p1(lastOf(cmB, "tax_revenue_net_pct_be").v);
  N["ex-ytd-cap"] = p1(lastOf(cmB, "capital_expenditure_pct_be").v);
  // budget path
  const k = "fiscal_deficit", pr = pathB.dates.map((d, i) => ({ fy: fyOf(d), be: pathB.series[k + "__be"].data[i], re: pathB.series[k + "__re"].data[i], pr: pathB.series[k + "__provisional"].data[i] }));
  const lastPr = [...pr].reverse().find((r) => r.pr != null), miss = (r) => (r.pr - r.be) / r.be * 100;
  N["pv-path"] = (miss(lastPr) < 0 ? "−" : "+") + Math.abs(miss(lastPr)).toFixed(1) + pc("%");
  N["ex-path-be"] = lc(lastPr.be);
  N["ex-path-re"] = lc(lastPr.re);
  N["ex-path-pr"] = lc(lastPr.pr);
  const worst = pr.filter((r) => r.be != null && r.pr != null).sort((a, b) => miss(b) - miss(a))[0];
  N["ex-path-max"] = `${worst.fy}, ${Math.round(miss(worst))}% above the budget`;
  // financing
  const mbBE = stageShare(cfB, "market_borrowings", "gross_fiscal_deficit").find((p) => p[2] === "be")[1];
  N["pv-financing"] = fmt.pct0(mbBE);
  N["ex-fin-acc"] = fmt.pct0(shareOf(cfB, "market_borrowings", "gross_fiscal_deficit")[cfB.dates.indexOf(`${ST.accountsTo.slice(0, 4)}-04-01`)][1]);
  N["ex-fin-be"] = fmt.pct0(mbBE);
  const bl = borrowB.dates.length - 1;
  N["ex-fin-gross"] = lc(borrowB.series.centre_gross.data[bl] + borrowB.series.states_gross.data[bl]);
  // § 05 taxes
  const tsh = (kk) => taxShare(kk).at(-1)[1];
  const topTax = TAXES.map(([kk]) => tsh(kk)).sort((a, b) => b - a)[0];
  N["pv-taxmix"] = fmt.pct0(topTax);
  N["ex-tax-pit"] = fmt.pct0(tsh("personal_income_tax"));
  N["ex-tax-cit"] = fmt.pct0(tsh("corporation_tax"));
  N["ex-tax-gst"] = fmt.pct0(tsh("gst"));
  N["ex-tax-exc"] = fmt.pct0(tsh("excise_duties"));
  N["ex-tax-cus"] = fmt.pct0(tsh("customs_duties"));
  const dAcc = atFY(g11B, "gross_direct_tax", ST.accountsTo), iAcc = atFY(g11B, "gross_indirect_tax", ST.accountsTo);
  N["pv-taxgdp"] = p1(dAcc);
  N["ex-tg-dir"] = p1(dAcc);
  N["ex-tg-ind"] = p1(iAcc);
  N["ex-tg-be"] = p1(firstOf(g11B, "total_gross_tax__be").v);
  const who = ctaxB.dates.map((d, i) => { const c = ctaxB.series.centre_total.data[i], s = ctaxB.series.states_total.data[i]; return c != null && s != null ? 100 * s / (c + s) : null; }).filter((v) => v != null).at(-1);
  N["pv-taxwho"] = p1(who);
  N["ex-tw-st"] = lc(atFY(ctaxB, "states_total", SS.accountsTo));
  N["ex-tw-c"] = lc(atFY(ctaxB, "centre_total", SS.accountsTo));
  // § 06 spending
  const be = spendParts((kk) => firstOf(ceB, kk + "__be").v);
  N["pv-spend"] = "₹" + be[0].v.toFixed(1);
  N["ex-sp-int"] = "₹" + be[0].v.toFixed(1);
  N["ex-sp-def"] = "₹" + be[1].v.toFixed(1);
  N["ex-sp-sub"] = "₹" + be[2].v.toFixed(1);
  N["ex-sp-cap"] = "₹" + be[4].v.toFixed(1);
  const cbe = 100 * firstOf(ceB, "interest_payments__be").v / firstOf(crB, "revenue_receipts__be").v;
  const ratioAt = (eb, ek, rb, rk, fy) => { const e = atFY(eb, ek, fy), r = atFY(rb, rk, fy); return 100 * e / r; };
  N["pv-interest"] = "₹" + cbe.toFixed(1);
  N["ex-int-acc"] = "₹" + ratioAt(ceB, "interest_payments", crB, "revenue_receipts", ST.accountsTo).toFixed(1);
  N["ex-int-be"] = "₹" + cbe.toFixed(1);
  N["ex-int-st"] = "₹" + ratioAt(sxB, "interest_payments", srxB, "total_revenue_receipts", SS.accountsTo).toFixed(1);
  N["pv-capex"] = p1(stagesOf(g11B, "capital_expenditure").at(-1)[1]);
  N["ex-cap-acc"] = p1(atFY(g11B, "capital_expenditure", ST.accountsTo));
  N["ex-cap-int"] = p1(atFY(g11B, "interest_payments", ST.accountsTo));
  // § 07 debt
  N["pv-debt"] = p1(debtBE);
  N["ex-debt-acc"] = p1(atFY(dg11B, DK.comb, SS.accountsTo));
  N["ex-debt-c"] = p1(firstOf(dg11B, DK.cen + "__be").v);
  N["ex-debt-s"] = p1(firstOf(dg11B, DK.sta + "__be").v);
  const oat = (kk) => ownB.series[kk].data.at(-1);
  N["pv-holders"] = lc(oat("total"));
  N["ex-h-total"] = lc(oat("total"));
  N["ex-h-pf"] = p1(oat("provident_funds") + oat("pension_funds"));
  N["ex-h-fpi"] = p1(oat("foreign_portfolio_investors"));
  N["ex-h-mf"] = p1(oat("mutual_funds"));
  const tl = (kk) => tbB.series[kk].data.at(-1);
  const tbTotal = ["t91__total", "t182__total", "t364__total"].reduce((a, kk) => a + (tl(kk) ?? 0), 0) + (tl("cmb__total") ?? 0);
  N["pv-tbills"] = lc(tbTotal);
  N["ex-tb-364"] = lc(tl("t364__total"));
  N["ex-tb-182"] = lc(tl("t182__total"));
  N["ex-tb-91"] = lc(tl("t91__total"));
  N["ex-tb-st"] = fmt.pct0(100 * tl("t91__state_governments") / tl("t91__total"));
  const mn = matB.dates.length - 1;
  N["pv-maturity"] = lc(matB.series.total_amount.data[mn]);
  N["ex-mat-total"] = lc(matB.series.total_amount.data[mn]);
  N["ex-mat-5"] = fmt.pct0(100 * (matB.series.under_5_years.data[mn] ?? 0) / matB.series.total_amount.data[mn]);
  const tot = lastOf(ssB, "total__outstanding"), lastV = (kk) => lastOf(ssB, kk)?.v ?? 0;
  N["pv-savings"] = lc(tot.v);
  N["ex-sv-1"] = `${schemeName(SCHEMES[0])} (${lc(lastV(SCHEMES[0]))})`;
  N["ex-sv-2"] = `${schemeName(SCHEMES[1])} (${lc(lastV(SCHEMES[1]))})`;
  const scss = lastOf(ssrB, "senior_citizens_saving_scheme"), posb = lastOf(ssrB, "post_office_savings_bank_accounts");
  N["ex-sv-when"] = dayOf(scss.date);
  N["ex-sv-scss"] = p1(scss.v);
  N["ex-sv-posb"] = p1(posb.v);
  // § 08 the states
  const rsh = (kk) => recShare(kk).at(-1)[1];
  N["pv-st-receipts"] = fmt.pct0(rsh("share_in_central_taxes") + rsh("grants_from_the_centre"));
  N["ex-sr-own"] = fmt.pct0(rsh("own_taxes"));
  N["ex-sr-share"] = fmt.pct0(rsh("share_in_central_taxes"));
  N["ex-sr-grant"] = fmt.pct0(rsh("grants_from_the_centre"));
  N["ex-sr-nt"] = fmt.pct0(rsh("own_non_tax"));
  const ssh = (kk) => spShare(kk).at(-1)[1];
  N["pv-st-spend"] = fmt.pct0(ssh("social_services"));
  N["ex-ss-soc"] = fmt.pct0(ssh("social_services"));
  N["ex-ss-eco"] = fmt.pct0(ssh("economic_services"));
  N["ex-ss-int"] = fmt.pct0(ssh("interest_payments"));
  N["ex-ss-cap"] = fmt.pct0(ssh("capital_outlay"));
  const med = stateRows.map((r) => r.debt).sort((a, c) => a - c)[Math.floor(stateRows.length / 2)];
  N["pv-state-cut"] = p1(med);
  N["ex-sc-n"] = String(stateRows.filter((r) => r.debt > 30).length);
  const lo = stateRows.at(-1);
  N["ex-sc-lo"] = `${lo.state}, ${p1(lo.debt)}`;
  const wl = (kk) => wmaB.series[kk].data.at(-1);
  N["pv-wma"] = String(wl("states_using_od"));
  N["ex-wma-od"] = String(wl("states_using_od"));
  N["ex-wma-wma"] = String(wl("states_using_wma"));
  N["ex-wma-sdf"] = String(wl("states_using_sdf"));
  const topOD = [...wmaRows].sort((a, c) => c.od - a.od)[0];
  N["ex-wma-top"] = topOD && topOD.od ? `${topOD.state}'s ${topOD.od}` : "none";
  // § 09 which GDP
  const acc = `${ST.accountsTo.slice(0, 4)}-04-01`;
  const nw = nn(cut(r22B.dates.map((d, i) => [d, r22B.series.centre_gross_fiscal_deficit.data[i]]), acc)).at(-1);
  const od = nn(cut(g11B.dates.map((d, i) => [d, g11B.series.gross_fiscal_deficit.data[i]]), acc)).at(-1);
  N["pv-gdpbase"] = p1(nw[1]);
  N["ex-gb-new"] = p1(nw[1]);
  N["ex-gb-old"] = p1(od[1]);
  return N;
}
