// Interest rates guide: the plates, drawn at build time with the chart kit (src/kit/). Each export
// returns a bare figure for a plate's .plotzone; titles, source lines and buttons stay in
// src/pages/guides/rates.astro. RBI rates are published to two decimals, so they are rounded once
// here at two (the page's prose uses the same figures). Separate rulers are never joined: the Bank
// Rate and the repo rate; the reverse repo and the SDF as the floor; deposit rates of all banks (to
// 1999-00) and five major banks (from 2000-01); CPI back-cast and live (the NSO's link, a seam).
import * as K from "../kit/kit.js";
import { figure } from "../kit/figure.js";
import { pairs, last, monthShort, monthLong } from "../kit/data.js";
import policyB from "../../data/series/rates-policy.json";
import monthlyB from "../../data/series/rates-monthly.json";
import mpcB from "../../data/series/rates-mpc.json";
import votesB from "../../data/series/rates-mpc-votes.json";
import lendB from "../../data/series/rates-lending.json";
import benchB from "../../data/series/rates-benchmarks.json";
import sectB from "../../data/series/rates-walr-sectors.json";
import occB from "../../data/series/rates-walr-occupation.json";
import mclrB from "../../data/series/rates-mclr.json";
import banksB from "../../data/series/rates-mclr-banks.json";
import wssB from "../../data/series/rates-wss.json";
import realB from "../../data/series/rates-real.json";
import curveB from "../../data/series/rates-gsec-curve.json";
import t91B from "../../data/series/rates-tbill-91.json";
import callmB from "../../data/series/rates-call-monthly.json";
import borrowB from "../../data/series/rates-borrowing.json";
import devB from "../../data/series/rates-gsec-auctions-fy.json";
import sdlB from "../../data/series/rates-sdl-states.json";
import structB from "../../data/series/rates-structure.json";

const PCT = { suffix: "%" };
// rounded as the page's prose rounds (toFixed), so a label and the sentence beside it agree to the last digit
const round = (v, d) => (v == null ? v : +v.toFixed(d));
/** [[date, value]] at the RBI's two decimals; nulls kept, so a missing week is a gap. */
const P2 = (b, k, o = {}) => pairs(b, k, { ...o, round: false }).map(([d, v]) => [d, v == null ? null : round(v, 2)]);
const solid = (P) => P.filter((p) => p[1] != null);
const fy = (iso) => { const y = +iso.slice(0, 4); return `${y}-${String((y + 1) % 100).padStart(2, "0")}`; };
const p2 = (v) => K.num(v, { dp: 2, suffix: "%" });
const csv = (cols, rows) => ({ cols, rows });
const allCols = (b, first) => csv([first, ...Object.keys(b.series).map((k) => b.series[k].name ?? k)], b.dates.map((d, i) => [d, ...Object.keys(b.series).map((k) => b.series[k].data[i])]));

/** The title block's small line: the repo rate since the MPC began. */
export const sparkRepo = () => K.spark(solid(P2(monthlyB, "repo", { from: "2016-10-01" })), { width: 190, height: 44 });

/** §04: the Bank Rate since 1935 and the repo rate since 2001, as the levels in force: steps, never joined. */
export function long() {
  const end = policyB.dates.at(-1), repo = solid(P2(policyB, "repo")), bank = solid(P2(policyB, "bank_rate"));
  return figure({
    bare: true, file: "india-atlas_policy-rates-since-1935",
    label: "The RBI's Bank Rate since 1935 and the repo rate since 2001, drawn as steps at the level in force on each day, as two separate lines",
    data: allCols(policyB, "date_of_change"),
    draw: (width) => K.line({
      width, unit: PCT, endDp: 2, hoverDp: 2, stepTo: end, height: width < 520 ? 280 : 440,
      series: [
        { name: "Bank Rate", short: "Bank\u00a0Rate", data: bank, role: "comp", step: true },
        { name: "Repo rate", data: repo, role: "lead", step: true },
      ],
      events: [{ t: repo[0][0], label: "Repo auctions begin, April 2001", short: "Repo from 2001", side: "left" }],
    }),
  });
}

/** §04: the weekly call rate inside the corridor; the floor is the reverse repo to April 2022 and the SDF after, two lines. */
export function corridor() {
  const D = wssB.dates, sdfStart = D.findIndex((d, i) => d >= "2022-04-01" && wssB.series.sdf.data[i] != null);
  const rev = P2(wssB, "reverse_repo").map((p, i) => [p[0], i < sdfStart ? p[1] : null]);
  const sdf = P2(wssB, "sdf").map((p, i) => [p[0], i >= sdfStart ? p[1] : null]);
  return figure({
    bare: true, file: "india-atlas_rbi-corridor-weekly",
    label: "The weekly call money rate against the repo rate, the ceiling (MSF) and the floor (reverse repo to April 2022, SDF from April 2022), since 2011",
    draw: (width) => K.line({
      width, unit: PCT, endDp: 2, hoverDp: 2, height: width < 520 ? 300 : 440,
      series: [
        { name: "Ceiling (MSF)", short: "Ceiling", data: P2(wssB, "msf"), role: "ctx", step: true },
        { name: "Floor (reverse repo)", data: rev, role: "ctx", step: true, label: false },
        { name: "Floor (SDF)", short: "Floor", data: sdf, role: "ctx", step: true },
        { name: "Repo rate", short: "Repo", data: P2(wssB, "repo"), role: "ctx", color: K.C.ink2, step: true },
        { name: "Call rate", data: P2(wssB, "call"), role: "lead" },
      ],
      events: [{ t: D[sdfStart], label: "SDF becomes the floor, April 2022", short: "SDF floor", side: "left" }],
    }),
  });
}

/** §04: CRR and SLR since 1935, the level in force on each day. */
export function reserve() {
  const end = policyB.dates.at(-1);
  return figure({
    bare: true, file: "india-atlas_crr-slr-since-1935",
    label: "Cash reserve ratio from 1962 and statutory liquidity ratio from 1949, per cent of deposits, drawn as steps to today",
    data: csv(["date_of_change", "crr_pct", "slr_pct"], policyB.dates.map((d, i) => [d, policyB.series.crr.data[i], policyB.series.slr.data[i]])),
    draw: (width) => K.line({
      width, unit: PCT, endDp: 2, hoverDp: 2, stepTo: end, tDomain: [K.tnum(policyB.dates[0]), K.tnum(end)], height: width < 520 ? 260 : 400,
      series: [
        { name: "SLR", data: solid(P2(policyB, "slr")), role: "ctx", color: K.C.ink2, step: true },
        { name: "CRR", data: solid(P2(policyB, "crr")), role: "lead", step: true },
      ],
    }),
  });
}

/** §05: every MPC decision as a column of basis points; a hold is a ring on the line. */
export function mpc() {
  const M = mpcB.meta.meetings, bps = mpcB.series.change_bps.data;
  const data = M.map((m, i) => [m.date, bps[i]]);
  const big = data.filter((p) => p[1] != null).reduce((a, b) => (Math.abs(b[1]) > Math.abs(a[1]) ? b : a));
  const sign = (v) => (v > 0 ? "+" : v < 0 ? "−" : "") + Math.abs(v);
  return figure({
    bare: true, file: "india-atlas_mpc-decisions",
    label: "Every Monetary Policy Committee decision since October 2016: the change in the repo rate in basis points, cuts below the line, hikes above, holds as rings",
    data: csv(["meeting_end", "meeting_no", "decision", "change_bps", "repo_pct", "stance", "votes_for", "votes_against"], M.map((m, i) => [m.date, m.n, m.decision, bps[i], mpcB.series.repo.data[i], m.stance, m.votesFor, m.votesAgainst])),
    draw: (width) => K.columns({
      width, data, unit: { suffix: " bp" }, valueDp: 0, sign: true, zeroMark: "held", height: width < 520 ? 260 : 340,
      events: [{ t: big[0].slice(0, 7), label: `${sign(big[1])} bp\n${monthLong(big[0])}` }],
    }),
  });
}

/** §05: each member's vote at each meeting with published minutes: a cell per vote. */
export function votes() {
  const V = votesB, mem = V.meta.members;
  const ROLE = { "External member": "external", Governor: "Governor", "Deputy Governor": "Deputy Governor", "Executive Director": "RBI officer" };
  const SHORT = { "External member": "ext.", Governor: "Gov.", "Deputy Governor": "DG", "Executive Director": "RBI" };
  const surname = (n) => n.split(" ").at(-1);
  const years = V.dates.map((d, j) => (j === 0 || d.slice(0, 4) !== V.dates[j - 1].slice(0, 4) ? d.slice(0, 4) : ""));
  // a year is labelled where its meetings begin; a part year of fewer than three meetings (2016) is not
  const yearCols = years.map((y, j) => (y ? j : -1)).filter((j) => j >= 0).filter((j, k, a) => (a[k + 1] ?? V.dates.length) - j >= 3);
  return figure({
    bare: true, file: "india-atlas_mpc-votes",
    label: "How each Monetary Policy Committee member voted on the repo-rate resolution at every meeting with published minutes: a cell per vote, votes against the decision in indigo",
    data: csv(["meeting_end", ...mem.map((m) => m.name)], V.dates.map((d, i) => [d, ...mem.map((m) => (V.series[m.key]?.data[i] == null ? "" : V.series[m.key].data[i] === 1 ? "with" : "against"))])),
    draw: (width) => {
      const phone = width < 560;
      return K.heatmap({
        width, cols: years, values: false,
        rows: mem.map((m) => ({ name: phone ? `${surname(m.name)}, ${SHORT[m.role] ?? ""}` : `${m.name}${ROLE[m.role] ? ", " + ROLE[m.role] : ""}`, full: m.name, cells: V.dates.map((_, i) => V.series[m.key]?.data[i] ?? null) })),
        fill: (v) => (v === 0 ? K.C.lead : K.C.ctx2),
        tip: (r, j, v) => `${r.full}, ${monthShort(V.dates[j])}: ${v === 0 ? "voted against" : "voted with the decision"}`,
        key: [{ label: "Voted against the decision", color: K.C.lead }, { label: "Voted with it", color: K.C.ctx2 }],
        // a year label where each year's meetings begin; on a phone every other year
        colShow: (j, ph) => yearCols.includes(j) && (!ph || yearCols.indexOf(j) % 2 === 0),
      });
    },
  });
}

/** §06: loan and deposit rates, new business and the whole book, against the repo rate. */
export function pass() {
  const L = lendB, from = L.dates[0], to = L.dates.at(-1);
  const keys = Object.keys(L.series);
  return figure({
    bare: true, file: "india-atlas_lending-deposit-rates",
    label: "Average lending rates on new loans and on all loans, and deposit rates on new and all fixed deposits, against the repo rate, monthly since 2012",
    data: csv(["month", ...keys.map((k) => L.series[k].name), "repo_month_end_pct"], L.dates.map((d, i) => [d, ...keys.map((k) => L.series[k].data[i]), monthlyB.series.repo.data[monthlyB.dates.indexOf(d)] ?? null])),
    draw: (width) => K.line({
      width, unit: PCT, endDp: 2, hoverDp: 2, height: width < 520 ? 300 : 460,
      series: [
        { name: "Repo rate", short: "Repo", data: P2(monthlyB, "repo", { from, to }), role: "ctx", color: K.C.ink2, step: true },
        { name: "All deposits", short: "All\u00a0deposits", data: P2(L, "wadtdr_outstanding_all"), role: "ctx", color: K.C.compTint },
        { name: "All loans", short: "All\u00a0loans", data: P2(L, "walr_outstanding_all"), role: "ctx", color: K.C.leadSoft },
        { name: "New deposits", short: "New\u00a0deposits", data: P2(L, "wadtdr_fresh_all"), role: "comp" },
        { name: "New loans", short: "New\u00a0loans", data: P2(L, "walr_fresh_all"), role: "lead" },
      ],
    }),
  });
}

/** §06: the share of floating-rate loans on each benchmark, quarter by quarter. */
export function bench() {
  return figure({
    bare: true, file: "india-atlas_loan-benchmarks",
    label: "Shares of outstanding floating-rate loans priced on an external benchmark, the MCLR, the base rate and others, quarterly since September 2019",
    data: allCols(benchB, "quarter_start"),
    draw: (width) => K.line({
      width, unit: PCT, endDp: 1, hoverDp: 1, yDomain: [0, 100], height: width < 520 ? 280 : 400,
      series: [
        { name: "Others", data: pairs(benchB, "all_others", { round: false }).map(([d, v]) => [d, round(v, 1)]), role: "ctx2" },
        { name: "Base rate", data: pairs(benchB, "all_base_rate", { round: false }).map(([d, v]) => [d, round(v, 1)]), role: "ctx2" },
        { name: "MCLR", data: pairs(benchB, "all_mclr", { round: false }).map(([d, v]) => [d, round(v, 1)]), role: "ctx", color: K.C.ink2 },
        { name: "External benchmark", short: "External benchmark", data: pairs(benchB, "all_eblr", { round: false }).map(([d, v]) => [d, round(v, 1)]), role: "lead" },
      ],
    }),
  });
}

/** §06: the rate on a new loan by purpose, now and a year earlier. */
export function loans() {
  const S = sectB, i = S.dates.length - 1, j = i - 12, r2 = (v) => (v == null ? null : round(v, 2));
  const rows = S.meta.sectors.map((s) => ({ name: s.label, a: r2(S.series["fresh_" + s.key].data[j]), b: r2(S.series["fresh_" + s.key].data[i]), highlight: s.key === "housing" })).filter((r) => r.a != null && r.b != null);
  const keys = Object.keys(S.series);
  return figure({
    bare: true, file: "india-atlas_loan-rates-by-purpose",
    label: `Average rate on new loans by purpose in ${monthLong(S.dates[i])}, against the rate a year earlier`,
    data: csv(["month", ...keys.map((k) => S.series[k].name)], S.dates.map((d, ii) => [d, ...keys.map((k) => S.series[k].data[ii])])),
    draw: (width) => K.dumbbell({ width, rows, keys: { a: monthShort(S.dates[j]), b: monthShort(S.dates[i]) }, unit: PCT, dp: 2, sortBy: "b" }),
  });
}

/** §06: the rate on all outstanding loans by the borrower's occupation, credit cards picked out. */
export function cards() {
  const O = occB, i = O.dates.length - 1;
  const rows = Object.entries(O.series).filter(([k]) => !/^total_credit/.test(k))
    .map(([k, s]) => ({ name: s.label.replace(/^WALR on outstanding loans: /, ""), value: s.data[i] == null ? null : round(s.data[i], 2), highlight: k === "personal_credit_cards" || k === "housing" }));
  const keys = Object.keys(O.series);
  return figure({
    bare: true, file: "india-atlas_loan-rates-by-occupation",
    label: "Average rate on outstanding loans by the borrower's occupation, ranked, credit cards and housing loans picked out",
    data: csv(["as_on", ...keys.map((k) => O.series[k].name)], O.dates.map((d, ii) => [d, ...keys.map((k) => O.series[k].data[ii])])),
    draw: (width) => K.bars({ width, rows, unit: PCT, dp: 2 }),
  });
}

/** §06: every bank's 1-year MCLR in the latest month, one strip per bank group on one shared scale. */
export function mclr() {
  const at = banksB.dates.at(-1), i = banksB.dates.length - 1;
  const banks = banksB.meta.banks.map((x) => ({ name: x.bank.replace(/\s+Ltd\.?$/, "").replace(/\.$/, ""), group: x.group, v: banksB.series[x.key].data[i] == null ? null : round(banksB.series[x.key].data[i], 2) })).filter((b) => b.v != null);
  const GR = [["public_sector", "public", "Public sector banks"], ["private_sector", "private", "Private banks"], ["foreign", "foreign", "Foreign banks"]];
  const vs = banks.map((b) => b.v), lo = Math.floor(Math.min(...vs)), hi = Math.ceil(Math.max(...vs));
  const all = banksB.meta.banks.map((x) => { const s = banksB.series[x.key].data; let k = s.length - 1; while (k >= 0 && s[k] == null) k--; return k < 0 ? null : [x.bank, x.group, s[k], banksB.dates[k], s[k - 12] ?? null]; }).filter(Boolean);
  return figure({
    bare: true, file: "india-atlas_mclr-by-bank",
    label: `The one-year MCLR of every bank that reported for ${monthLong(at)}, as dots on one scale, public sector, private and foreign banks in separate rows, each with its group's median`,
    data: csv(["bank", "group", "mclr_1y_pct", "month", "a_year_earlier_pct"], all),
    draw: (width) => K.strip({
      width, unit: PCT, dp: 2, clamp: [lo, hi],
      groups: GR.map(([g, mk, label]) => {
        const rows = banks.filter((b) => b.group === g).sort((a, b) => a.v - b.v);
        return { name: label, values: rows.map((b) => ({ name: b.name, v: b.v })), ref: { value: last(P2(mclrB, `${mk}_median`))[1], label: "median" }, label: rows.length > 2 ? [rows[0].name, rows.at(-1).name] : [] };
      }),
    }),
  });
}

/** §06: what savers are offered (the card-rate band, savings rates) and what new deposits earn. */
export function savers() {
  const W = wssB, lo = P2(W, "term_deposit_min"), hi = P2(W, "term_deposit_max");
  return figure({
    bare: true, file: "india-atlas_deposit-rates",
    label: "Card rates on term deposits of more than a year at major banks as a band from lowest to highest, the savings account rate, and the average rate on new fixed deposits, since 2011",
    data: csv(["week", "term_deposit_over_1y_low_pct", "term_deposit_over_1y_high_pct", "savings_low_pct", "savings_high_pct"], W.dates.map((d, i) => [d, W.series.term_deposit_min.data[i], W.series.term_deposit_max.data[i], W.series.savings_min.data[i], W.series.savings_max.data[i]])),
    draw: (width) => K.line({
      width, unit: PCT, endDp: 2, hoverDp: 2, height: width < 520 ? 300 : 440,
      ranges: [{ data: lo.map((p, i) => [p[0], p[1], hi[i][1]]) }],
      series: [
        { name: "Card rates, lowest", short: "Card\u00a0low", data: lo, role: "ctx", color: K.C.leadTint },
        { name: "Card rates, highest", short: "Card\u00a0top", data: hi, role: "ctx", color: K.C.leadTint },
        { name: "Savings account", short: "Savings", data: P2(W, "savings_max"), role: "ctx", color: K.C.ink2 },
        { name: "New deposits, actual", short: "New\u00a0deposits", data: P2(lendB, "wadtdr_fresh_all"), role: "lead" },
      ],
    }),
  });
}

/** §07: real rates on deposits and the repo; CPI is the NSO's back-cast to 2024, then live (a seam, drawn paler before). */
export function real() {
  const one = (k) => pairs(realB, k, { round: false }).map(([d, v]) => [d, v == null ? null : round(v, 1)]);
  const keys = Object.keys(realB.series);
  return figure({
    bare: true, file: "india-atlas_real-interest-rates",
    label: "Real interest rates on new and on all fixed deposits and on the repo rate, each minus CPI inflation, monthly since 2014; before 2025 the CPI is the NSO's back-cast",
    data: csv(["month", ...keys.map((k) => realB.series[k].name)], realB.dates.map((d, i) => [d, ...keys.map((k) => realB.series[k].data[i])])),
    draw: (width) => K.line({
      width, unit: PCT, endDp: 1, hoverDp: 1, height: width < 520 ? 300 : 440,
      series: [
        { name: "Repo rate", short: "Repo", data: one("repo"), role: "ctx2" },
        { name: "All fixed deposits", short: "All\u00a0deposits", data: one("fd_outstanding"), role: "ctx", color: K.C.ink2 },
        { name: "New fixed deposits", short: "New\u00a0deposits", data: one("fd_fresh"), role: "lead", recon: "2024-12-01" },
      ],
      seam: { t: "2025-01-01", before: "CPI back-cast", after: "Live CPI" },
    }),
  });
}

/** §08: the yield curve at the latest month-end, a year and five years earlier. */
export function curve() {
  const Cv = curveB, n = Cv.dates.length - 1;
  const lastI = (i) => { while (i >= 0 && Cv.series.y10.data[i] == null) i--; return i; };
  const picks = [[lastI(n), "lead"], [lastI(n - 12), "ctx"], [lastI(n - 60), "ctx2"]].filter(([i]) => i >= 0);
  const curveOf = (i) => [...Array(30)].map((_, k) => [String(k + 1), Cv.series[`y${k + 1}`].data[i] == null ? null : round(Cv.series[`y${k + 1}`].data[i], 2)]);
  return figure({
    bare: true, file: "india-atlas_yield-curve",
    label: `Government bond yields at each whole year to maturity from 1 to 30 years, at the end of ${monthLong(Cv.dates[picks[0][0]])}, a year earlier and five years earlier`,
    data: csv(["years_to_maturity", ...picks.map(([i]) => Cv.dates[i])], [...Array(30)].map((_, k) => [k + 1, ...picks.map(([i]) => Cv.series[`y${k + 1}`].data[i])])),
    draw: (width) => K.line({
      width, unit: PCT, endDp: 2, hoverDp: 2, freq: "year", zero: false, xUnit: " years", tDomain: [1, 30], height: width < 520 ? 280 : 400,
      series: picks.slice().reverse().map(([i, role]) => ({ name: monthShort(Cv.dates[i]), short: Cv.dates[i].slice(0, 4), data: curveOf(i), role, color: role === "ctx" ? K.C.ink2 : undefined })),
    }),
  });
}

/** §08: the 91-day bill at each weekly auction and the month-end 10-year yield. */
export function tbill() {
  return figure({
    bare: true, file: "india-atlas_tbill-91-and-10y",
    label: "Cut-off yield of the 91-day Treasury bill at each weekly auction since 1993 and the month-end 10-year government bond yield since 1996",
    draw: (width) => K.line({
      width, unit: PCT, endDp: 2, hoverDp: 2, height: width < 520 ? 280 : 420,
      series: [
        { name: "10-year bond", data: P2(curveB, "y10"), role: "comp" },
        { name: "91-day bill", data: P2(t91B, "cutoff_yield"), role: "lead" },
      ],
    }),
  });
}

/** §08: call money since 1990, the monthly average and the highest deal of each month. */
export function call() {
  return figure({
    bare: true, file: "india-atlas_call-money-monthly",
    label: "Call money rate since April 1990, the monthly average and the highest deal struck in each month",
    data: csv(["month", "average_pct", "high_pct", "low_pct"], callmB.dates.map((d, i) => [d, callmB.series.average.data[i], callmB.series.high.data[i], callmB.series.low.data[i]])),
    draw: (width) => K.line({
      width, unit: PCT, endDp: 2, hoverDp: 2, height: width < 520 ? 280 : 420,
      series: [
        { name: "Highest deal", short: "Highest\u00a0deal", data: P2(callmB, "high"), role: "ctx2" },
        { name: "Average", data: P2(callmB, "average"), role: "lead" },
      ],
    }),
  });
}

/** §09: gross market borrowing of the centre and the states, ₹ lakh crore. */
export function borrow() {
  const lc = (k) => pairs(borrowB, k, { round: false }).map(([d, v]) => [d, v == null ? null : v / 1e5]);
  return figure({
    bare: true, file: "india-atlas_government-market-borrowing",
    label: "Gross market borrowing of the central government and of all state governments, ₹ lakh crore, financial years since 1980-81",
    data: allCols(borrowB, "financial_year_start"),
    draw: (width) => K.line({
      width, freq: "fy", unit: { prefix: "₹", suffix: " lakh cr" }, endDp: 1, hoverDp: 1, height: width < 520 ? 280 : 400,
      series: [
        { name: "States", data: lc("states_gross"), role: "comp" },
        { name: "Centre", data: lc("centre_gross"), role: "lead" },
      ],
    }),
  });
}

/** §09: bonds devolved on primary dealers each financial year; the largest year named. */
export function devolve() {
  const data = devB.dates.map((d, i) => [d, devB.series.devolved_pd.data[i]]);
  const top = data.filter((p) => p[1] != null).reduce((a, b) => (b[1] > a[1] ? b : a));
  return figure({
    bare: true, file: "india-atlas_gsec-devolvement",
    label: "Central government bonds devolved on primary dealers at auction, ₹ crore, by financial year since 1995-96; the current year is not over",
    data: csv(["financial_year", "devolved_on_primary_dealers_inr_crore", "auction_days_with_devolvement"], devB.dates.map((d, i) => [fy(d), devB.series.devolved_pd.data[i], devB.series.auctions_devolved.data[i]])),
    draw: (width) => K.columns({
      width, data, freq: "fy", unit: { prefix: "₹", suffix: " cr" }, valueDp: 0, highlight: "none", height: width < 520 ? 250 : 340,
      fillOf: (p) => (p.d === top[0] ? K.C.lead : null),
      events: [{ t: top[0].slice(0, 7), label: `₹${K.inGroup(Math.round(top[1]))} crore\n${fy(top[0])}` }],
    }),
  });
}

/** §09: each state's cut-off yield in the last complete financial year, against the all-state average. */
export function states() {
  const today = mpcB.meta.meetings.at(-1).date;
  const fyNow = `${+today.slice(0, 4) - (+today.slice(5, 7) >= 4 ? 0 : 1)}-04-01`;
  const i = sdlB.dates.filter((d) => d < fyNow).length - 1;
  const rows = Object.entries(sdlB.series).filter(([k]) => k.endsWith("_yield") && !k.endsWith("_wavg_yield") && k !== "all_yield")
    .map(([, s]) => ({ name: s.label.split(":")[0], y: s.data[i] == null ? null : round(s.data[i], 2) }));
  const avg = round(sdlB.series.all_yield.data[i], 2);
  // the gaps are a fraction of a point, so each bar is the state's distance from the all-state
  // average (bars from zero would draw 31 equal lengths); the yield itself rides in the name
  const devs = rows.filter((r) => r.y != null).map((r) => ({ name: `${r.name}, ${p2(r.y)}`, value: round(r.y - avg, 2) }));
  return figure({
    bare: true, file: "india-atlas_state-borrowing-costs",
    label: `Cut-off yield on each state's market loans in ${fy(sdlB.dates[i])}, ranked, drawn as the gap above or below the all-state average of ${p2(avg)}`,
    data: allCols(sdlB, "financial_year_start"),
    draw: (width) => K.bars({ width, rows: devs, unit: { suffix: " pt" }, dp: 2 }),
  });
}

/** §10: the one-to-three-year deposit rate: all banks' prescribed rate to 1999-00, five major banks' range from 2000-01. */
export function structure() {
  const St = structB, cb = P2(St, "cb_dep_1_3_high"), lo = P2(St, "fmb_dep_1_3_low"), hi = P2(St, "fmb_dep_1_3_high");
  const peak = solid(cb).reduce((a, b) => (b[1] > a[1] ? b : a));
  const keys = Object.keys(St.series);
  return figure({
    bare: true, file: "india-atlas_structure-of-interest-rates",
    label: "Deposit rates for one to three years: the rate for all commercial banks to 1999-00 and the range at five major banks from 2000-01, two separate rulers, financial years since 1970-71",
    data: csv(["financial_year_start", ...keys.map((k) => St.series[k].name)], St.dates.map((d, i) => [d, ...keys.map((k) => St.series[k].data[i])])),
    draw: (width) => K.line({
      width, freq: "fy", unit: PCT, endDp: 2, hoverDp: 2, height: width < 520 ? 280 : 400,
      ranges: [{ data: lo.map((p, i) => [p[0], p[1], hi[i][1]]) }],
      series: [
        { name: "All commercial banks", data: cb, role: "ctx", color: K.C.ink2, label: false },
        { name: "Five major banks, low", short: "Bottom of range", data: lo, role: "ctx", color: K.C.leadSoft },
        { name: "Five major banks, high", short: "Top of range", data: hi, role: "lead" },
      ],
      seam: { t: "2000-04-01", before: "All banks", after: "Five major banks" },
      notes: [{ d: peak[0], v: peak[1], text: `${p2(peak[1])}\npeak, ${fy(peak[0])}`, side: "right" }],
    }),
  });
}
