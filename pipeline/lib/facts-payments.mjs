// pipeline/lib/facts-payments.mjs: the facts sheet for the payments guide (registry `factsModule`).
//
// Why a module of its own: the current bundle, payments-monthly, holds 57 payment lines as raw
// counts and rupees, number and value for each. facts.mjs would rank its "movers" by the raw
// change in those levels, so the largest mover would always be whichever line moves the most
// rupees (RTGS), whatever happened. Here the sheet carries the lines a reader asks about, with
// growth on a year earlier computed from the levels, and the extremes and contradictions ranked
// by that growth among the numbers of payments. Shares, averages, cash, infrastructure, the
// fiscal year and the e-rupee are computed in code into `cross`, so the writer never does
// arithmetic. Series keys are payments-monthly's own, so verify.mjs reads each with its unit
// (count, rupees) and lets the prose restate it in crore or lakh crore.
import fs from "node:fs";
import path from "node:path";
import YAML from "yaml";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const r1 = (v) => (v == null ? null : Math.round(v * 10) / 10);
const r2 = (v) => (v == null ? null : Math.round(v * 100) / 100);
const g = (a, b) => (a == null || b == null || b === 0 ? null : r1((a / b - 1) * 100));
const monthOf = (iso) => `${MONTHS[+iso.slice(5, 7) - 1]} ${iso.slice(0, 4)}`;
const fyOf = (iso) => `${+iso.slice(0, 4) - 1}-${iso.slice(2, 4)}`;

// the lines the sheet describes: [key, plain label]
const LINES = [
  ["upi_volume", "UPI, number of payments"], ["upi_value", "UPI, value"],
  ["imps_volume", "IMPS, number of payments"], ["imps_value", "IMPS, value"],
  ["neft_volume", "NEFT, number of payments"], ["neft_value", "NEFT, value"],
  ["rtgs_volume", "RTGS, number of payments"], ["rtgs_value", "RTGS, value"],
  ["credit_cards_volume", "Credit card payments, number"], ["debit_cards_volume", "Debit card payments, number"],
  ["ppi_volume", "Wallet and prepaid card payments, number"], ["paper_volume", "Cheques and other paper, number"],
  ["nach_dr_volume", "NACH debits (EMIs, SIPs, bills), number"], ["nach_cr_volume", "NACH credits (salaries, pensions), number"],
  ["apbs_volume", "APBS benefit credits, number"], ["netc_volume", "FASTag tolls (NETC), number"],
  ["atm_cash_volume", "Cash withdrawals at ATMs, number"], ["atm_cash_value", "Cash withdrawals at ATMs, value"],
  ["microatm_cash_volume", "AePS cash withdrawals at micro ATMs, number"],
  ["retail_total_volume", "All retail payments, number"], ["total_value", "All payments (RTGS and retail), value"],
];
// lines the extremes and contradictions are ranked among: numbers of payments, not totals
const RANKED = ["upi_volume", "imps_volume", "neft_volume", "rtgs_volume", "credit_cards_volume", "debit_cards_volume", "ppi_volume", "paper_volume",
  "nach_dr_volume", "nach_cr_volume", "apbs_volume", "netc_volume", "atm_cash_volume", "microatm_cash_volume"];

export default async function buildFacts(slug, ROOT, D) {
  if (slug !== "payments") throw new Error(`facts-payments: no sheet for "${slug}"`);
  const load = (b) => JSON.parse(fs.readFileSync(path.join(ROOT, "data/series", b + ".json"), "utf8"));
  const m = load(D.currentBundle), t = load("payments-ticket"), inf = load("payments-infra"), a = load("payments-annual");
  const wss = load("payments-growth-wss"), e = load("payments-erupee"), cash = load("credit-money");
  const seams = YAML.parse(fs.readFileSync(path.join(ROOT, "data/sources.yml"), "utf8")).seams?.payments ?? [];
  const rulerOf = (b) => { const s = seams.find((x) => x.bundles.includes(b)); return { bundle: b, base: s?.base ?? null, product: "payments", window: s ? { from: s.from, to: s.to } : null, current: s ? s.to == null : null, agencyLink: null }; };
  const L = m.dates.length - 1, Y = L - 12;
  const period = monthOf(m.dates[L]);

  const facts = {
    dossier: slug, bundle: D.currentBundle, base: m.meta.base, vintage: m.meta.vintage, latestPeriod: period, releaseDate: m.meta.releaseDate ?? null, bands: null,
    ruler: rulerOf(D.currentBundle), series: {}, cross: {},
  };
  for (const [k, label] of LINES) {
    const d = m.series[k].data;
    if (d[L] == null) throw new Error(`facts-payments: ${k} has no value for ${period}`);
    let mx = null, mn = null;
    d.forEach((v, i) => { if (v == null) return; if (!mx || v > mx.value) mx = { value: v, period: monthOf(m.dates[i]) }; if (!mn || v < mn.value) mn = { value: v, period: monthOf(m.dates[i]) }; });
    let run = null;
    for (let i = L; i > 0; i--) { const s = d[i] > d[i - 1] ? 1 : d[i] < d[i - 1] ? -1 : 0; if (!s) break; if (!run) run = { direction: s > 0 ? "up" : "down", length: 1 }; else if ((s > 0) === (run.direction === "up")) run.length++; else break; }
    if (run) run.since = monthOf(m.dates[L - run.length]);
    if (run) run.meaning = "months in a row the level rose (or fell) on the month before; not a growth rate";
    facts.series[k] = {
      label, ruler: `${m.meta.base}, ${D.currentBundle}`, levelBased: true,
      latest: { value: d[L], period }, previous: { value: d[L - 1], period: monthOf(m.dates[L - 1]) }, yearAgo: { value: d[Y], period: monthOf(m.dates[Y]) },
      growthVsPrevPct: g(d[L], d[L - 1]), growthVsYearPct: g(d[L], d[Y]),
      first: { value: d[0], period: monthOf(m.dates[0]) }, timesSinceFirst: d[0] ? r1(d[L] / d[0]) : null,
      min: mn, max: mx, run, streaks: { negative: 0 },
    };
  }
  // extremes and contradictions among the numbers of payments, by growth on a year earlier
  const ranked = RANKED.map((k) => ({ key: k, label: facts.series[k].label, latest: facts.series[k].latest.value, latestPeriod: period, growthVsYearPct: facts.series[k].growthVsYearPct }))
    .sort((x, y) => y.growthVsYearPct - x.growthVsYearPct);
  const upiUp = facts.series.upi_volume.growthVsYearPct > 0;
  facts.cross = {
    headlineKey: "upi_volume",
    note: "Numbers of payments are counts; cite them in crore (1 crore = 10 million) as the sheet's values restate. Values are rupees; cite them in lakh crore or crore. Growth is on the same month a year earlier. topMover and bottomMover rank the numbers of payments by that growth.",
    topMover: ranked[0], bottomMover: ranked.at(-1),
    topByLatest: ranked.slice().sort((x, y) => y.latest - x.latest)[0], bottomByLatest: ranked.slice().sort((x, y) => x.latest - y.latest)[0],
    contradictions: upiUp ? ranked.filter((r) => r.growthVsYearPct < 0).map((r) => ({ key: r.key, label: r.label, growthVsYearPct: r.growthVsYearPct })) : [],
    countFalling: ranked.filter((r) => r.growthVsYearPct < 0).length, countRising: ranked.filter((r) => r.growthVsYearPct > 0).length, countRanked: ranked.length,
    ranking: ranked.map((r) => ({ key: r.key, label: r.label, growthVsYearPct: r.growthVsYearPct })),
  };
  const S = (k, i = L) => m.series[k].data[i];
  // the month's UPI figures as the prose writes them (crore payments, ₹ lakh crore)
  facts.cross.upi = { period, payments_crore: r2(S("upi_volume") / 1e7), payments_year_ago_crore: r2(S("upi_volume", Y) / 1e7), yearAgoPeriod: monthOf(m.dates[Y]),
    value_lakh_crore: r2(S("upi_value") / 1e12), value_year_ago_lakh_crore: r2(S("upi_value", Y) / 1e12),
    paymentsGrowthPct: facts.series.upi_volume.growthVsYearPct, valueGrowthPct: facts.series.upi_value.growthVsYearPct,
    first_payments_crore: r2(S("upi_volume", 0) / 1e7), firstPeriod: monthOf(m.dates[0]) };
  const pctOf = (a2, b) => r1((100 * a2) / b);
  facts.cross.shares = {
    period,
    upiOfRetailPaymentsPct: pctOf(S("upi_volume"), S("retail_total_volume")),
    upiOfRetailPaymentsYearAgoPct: pctOf(S("upi_volume", Y), S("retail_total_volume", Y)),
    upiOfRetailPaymentsFirstPct: pctOf(S("upi_volume", 0), S("retail_total_volume", 0)), firstPeriod: monthOf(m.dates[0]),
    upiOfValuePct: pctOf(S("upi_value"), S("total_value")),
    rtgsOfValuePct: pctOf(S("rtgs_value"), S("total_value")),
    neftOfValuePct: pctOf(S("neft_value"), S("total_value")),
    creditOverDebitCardPaymentsAllChannels: r1(S("credit_cards_volume") / S("debit_cards_volume")),
    creditOverDebitCardPaymentsAtShopsPoS: r1(S("credit_cards_pos_volume") / S("debit_cards_pos_volume")),
  };
  const T = (k, i = t.dates.length - 1) => t.series[k].data[i];
  facts.cross.averagePayment = {
    period, note: "Means (value divided by number); the RBI publishes no median.",
    upi_rupees: Math.round(T("upi")), upi_year_ago_rupees: Math.round(T("upi", t.dates.length - 13)), upi_first_rupees: Math.round(T("upi", 0)),
    debit_card_rupees: Math.round(T("debit_cards")), credit_card_rupees: Math.round(T("credit_cards")), atm_withdrawal_rupees: Math.round(T("atm_cash")),
    neft_rupees: Math.round(T("neft")), imps_rupees: Math.round(T("imps")), rtgs_lakh: r1(T("rtgs") / 1e5), fastag_rupees: Math.round(T("netc")),
  };
  // cash held: currency with the public, the latest reporting fortnight and the one nearest a year before
  const cd = cash.dates, cv = cash.series.currency_with_public.data, ci = cd.length - 1;
  const yAgoIso = `${+cd[ci].slice(0, 4) - 1}${cd[ci].slice(4)}`;
  let cy = 0; cd.forEach((d, i) => { if (Math.abs(new Date(d) - new Date(yAgoIso)) < Math.abs(new Date(cd[cy]) - new Date(yAgoIso))) cy = i; });
  facts.cross.cash = {
    source: "RBI money supply, as baked for this site's credit guide (credit-money)",
    currencyWithPublic_lakh_crore: r2(cv[ci]), asOf: `${+cd[ci].slice(8, 10)} ${monthOf(cd[ci])}`,
    yearAgo_lakh_crore: r2(cv[cy]), yearAgoAsOf: `${+cd[cy].slice(8, 10)} ${monthOf(cd[cy])}`, growthPct: g(cv[ci], cv[cy]),
  };
  const I = (k, i = inf.dates.length - 1) => inf.series[k].data[i];
  const IY = inf.dates.length - 13;
  facts.cross.infrastructure = {
    period: monthOf(inf.dates.at(-1)),
    upiQrCodes_crore: r2(I("upi_qr") / 1e7), cardMachines_lakh: r1(I("pos") / 1e5), cardMachinesGrowthPct: g(I("pos"), I("pos", IY)),
    atms_lakh: r2(I("atms") / 1e5), microAtms_lakh: r1(I("micro_atms") / 1e5),
    creditCards_crore: r2(I("credit_cards") / 1e7), debitCards_crore: r2(I("debit_cards") / 1e7),
  };
  const an = a.dates.length - 1;
  facts.cross.fiscalYear = {
    year: fyOf(a.dates[an]), upi_crore: r2(a.series.upi_volume.data[an] / 1e7), allPayments_crore: r2(a.series.total_volume.data[an] / 1e7),
    upiSharePct: pctOf(a.series.upi_volume.data[an], a.series.total_volume.data[an]),
  };
  const en = e.dates.length - 1;
  facts.cross.eRupee = { asOf: `31 March ${e.dates[en].slice(0, 4)}`, inCirculation_crore: r2(e.series.total.data[en] / 1e7), yearEarlier_crore: r2(e.series.total.data[en - 1] / 1e7) };
  facts.cross.rbiPrintedGrowth = { period: monthOf(wss.dates.at(-1)), upiVolumePct: wss.series.upi_volume_yoy.data.at(-1), upiValuePct: wss.series.upi_value_yoy.data.at(-1),
    note: "The RBI's own printed growth (Weekly Statistical Supplement); the same as the sheet's growth to one decimal." };
  return facts;
}
