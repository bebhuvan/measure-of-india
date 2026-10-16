// Banks guide: the plates, drawn at build time with the chart kit (src/kit/). Each export returns a
// bare figure for a plate's .plotzone; the plate's title, source line and buttons stay in
// src/pages/guides/banks.astro. Data: bankData() (src/dossiers/banks.data.js), the same build-time
// extract the page's numbers read, so a label on a chart and the figure in the text are one value.
// Rates are per cent at two decimals, as the RBI prints them; amounts ₹ crore in the data, ₹ lakh
// crore on the charts. A merged bank's series ends and the acquirer's carries on: never joined.
import * as K from "../kit/kit.js";
import { figure } from "../kit/figure.js";
import { bankData } from "./banks.data.js";
import * as fmt from "../charts/format.js";

const C = K.C;
let memo = null;
const data = () => (memo ??= bankData());
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const monthOf = (iso) => `${MONTHS[+iso.slice(5, 7) - 1]} ${iso.slice(0, 4)}`;
const PCT = { suffix: "%" };
const pct2 = (v) => K.num(v, { dp: 2, suffix: "%" });
const hp = (D, k) => D.healthDates.map((d, i) => [d, D.health[k][i]]);
const r1 = (n) => Math.round(n * 10) / 10;
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;");
const phoneW = (w) => w < 520;

// bank groups keep one colour on every plate: public sector indigo, private sector sindoor,
// foreign and small finance banks in greys, all banks in ink
const GROUP = {
  psb: { name: "Public sector banks", short: "Public sector", role: "lead" },
  private: { name: "Private sector banks", short: "Private sector", role: "comp" },
  foreign: { name: "Foreign banks", short: "Foreign", role: "ctx" },
  sfb: { name: "Small finance banks", short: "Small finance", role: "ctx2" },
  all: { name: "All banks", short: "All banks", role: "cat", color: C.ink2 },
};
const FILL = { psb: C.lead, private: C.comp, foreign: C.ctx, sfb: C.ctx2 };

// ---- composition: kit drawings side by side or stacked, as one svg (two scales never share an
// axis; each panel is a full kit drawing, moved into place). Hover is dropped on composed plates:
// every value is labelled, and the CSV carries the series.
function moved(svg, dx, dy) {
  const body = svg.replace(/^<svg[^>]*>/, "").replace(/<\/svg>\s*$/, "").replace(/<rect class="ak-hit"[^>]*\/>/g, "");
  return body
    .replace(/\s(x|x1|x2|cx)="(-?[\d.]+)"/g, (_, k, v) => ` ${k}="${r1(+v + dx)}"`)
    .replace(/\s(y|y1|y2|cy)="(-?[\d.]+)"/g, (_, k, v) => ` ${k}="${r1(+v + dy)}"`)
    .replace(/\sd="([^"]*)"/g, (_, d) => ` d="${d.replace(/([MLHV])([^MLHVZ]*)/g, (m, c, n) => {
      const a = n.trim().split(/[\s,]+/).filter(Boolean).map(Number);
      if (c === "H") return "H" + r1(a[0] + dx);
      if (c === "V") return "V" + r1(a[0] + dy);
      const o = []; for (let i = 0; i < a.length; i += 2) o.push(r1(a[i] + dx) + "," + r1(a[i + 1] + dy));
      return c + o.join("L");
    })}"`);
}
const sizeOf = (svg) => [+svg.match(/width="([\d.]+)"/)[1], +svg.match(/height="([\d.]+)"/)[1]];
const text = (x, y, t, { size = 12.5, fill = C.ink, weight = 600, anchor = "start" } = {}) =>
  `<text x="${r1(x)}" y="${r1(y)}" font-size="${size}" fill="${fill}"${anchor !== "start" ? ` text-anchor="${anchor}"` : ""}${weight !== 400 ? ` font-weight="${weight}"` : ""}>${esc(t)}</text>`;
const open = (W, H) => `<svg class="ak" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="">`;

/** Two panels, each titled: side by side when the drawing is wide, stacked on a phone. */
function panels(width, [a, b], draw) {
  const side = width >= 700, gap = 48, pw = side ? Math.floor((width - gap) / 2) : width, head = 24;
  const A = draw(a, pw), B = draw(b, pw), [, ha] = sizeOf(A), [, hb] = sizeOf(B);
  const H = side ? head + Math.max(ha, hb) : head * 2 + ha + hb + 28;
  const bx = side ? pw + gap : 0, by = side ? 0 : head + ha + 28;
  return open(width, H) + text(0, 15, a.title) + moved(A, 0, head) + text(bx, by + 15, b.title) + moved(B, bx, by + head) + "</svg>";
}

/** A key row above a kit drawing: swatches for bar colours, a ring for a second value. */
function keyed(svg, items) {
  const [W, H] = sizeOf(svg);
  let k = "", x = 0, y = 12, rows = 1;
  for (const it of items) {
    const w = 16 + K.tw(it.label, 12.5) + 20;
    if (x + w > W && x > 0) { x = 0; y += 20; rows++; }
    k += it.ring ? `<circle cx="${x + 5}" cy="${y - 4}" r="4" fill="#fff" stroke="${C.ink2}" stroke-width="1.5"/>`
      : `<rect x="${x}" y="${y - 9}" width="10" height="10" fill="${it.color}"/>`;
    k += text(x + 16, y, it.label, { size: 12.5, fill: C.ink2, weight: 400 });
    x += w;
  }
  const dy = rows * 20 + 8;
  return open(W, H + dy) + k + moved(svg, 0, dy) + "</svg>";
}

// a table of several [date, value] series joined on date, for the CSV
function joined(list) {
  const dates = [...new Set(list.flatMap(([, p]) => p.map(([d]) => d)))].sort();
  const maps = list.map(([, p]) => new Map(p));
  return { cols: ["date", ...list.map(([n]) => n)], rows: dates.map((d) => [d, ...maps.map((m) => m.get(d) ?? null)]) };
}
const groupLine = (D, g, key) => ({ ...GROUP[g], data: hp(D, `${g}_${key}`) });

/* § 01: the title block's small line */
export function spark() {
  const D = data();
  return K.spark(hp(D, "all_gnpa").filter(([, v]) => v != null), { width: 190, height: 44 });
}

/* § 04 bad loans by bank group */
export function npa() {
  const D = data();
  const psb = hp(D, "psb_gnpa").filter(([, v]) => v != null), pk = psb.reduce((p, c) => (c[1] > p[1] ? c : p));
  return figure({
    bare: true, file: "india-atlas_bank-bad-loans-by-group",
    label: `Gross NPA ratio of India's banks by bank group, every quarter since December 2013; public sector banks peaked at ${pct2(pk[1])} in ${monthOf(pk[0])}`,
    data: joined(["all", "psb", "private", "foreign", "sfb"].flatMap((g) => [[`${g}_gross_npa_ratio_pct`, hp(D, `${g}_gnpa`).filter(([, v]) => v != null)], [`${g}_net_npa_ratio_pct`, hp(D, `${g}_nnpa`).filter(([, v]) => v != null)]])),
    draw: (width) => K.line({
      width, freq: "month", unit: PCT, endDp: 2, hoverDp: 2,
      series: ["sfb", "foreign", "all", "private", "psb"].map((g) => groupLine(D, g, "gnpa")),
      notes: [{ d: pk[0], v: pk[1], text: `${pct2(pk[1])}, ${monthOf(pk[0])}\npublic sector banks' peak` }],
    }),
  });
}

/* § 05 shares of deposits and advances by group: two panels, one scale */
export function shares() {
  const D = data(), G = ["sfb", "foreign", "private", "psb"];
  return figure({
    bare: true, file: "india-atlas_bank-group-shares",
    label: "Each bank group's share of all banks' deposits and of advances in India, every quarter since December 2013: public sector banks falling, private sector banks rising",
    data: joined(["psb", "private", "foreign", "sfb"].flatMap((g) => ["deposits", "advances"].map((w) => [`${g}_${w}_share_pct`, D.shares[`${g}__${w}`]]))),
    draw: (width) => panels(width, [{ title: "Deposits", w: "deposits" }, { title: "Advances", w: "advances" }], (p, pw) => K.line({
      width: pw, height: phoneW(pw) ? 250 : 360, freq: "month", unit: PCT, endDp: 1, yDomain: [0, 80],
      series: G.map((g) => ({ ...GROUP[g], data: D.shares[`${g}__${p.w}`] })),
    })),
  });
}

/* § 05 the fifteen largest banks by deposits: share now (bar), December 2013 (ring) */
export function biggest() {
  const D = data();
  return figure({
    bare: true, file: "india-atlas_largest-banks-by-deposits",
    label: "The fifteen largest banks by deposits in India, their share of all banks' deposits in the latest quarter and in December 2013",
    data: { cols: ["bank", "group", `deposits_${D.bsLatest}_inr_crore`, `share_${D.bsLatest}_pct`, `share_${D.bsFirst}_pct`, "merger"], rows: D.biggest.map((r) => [r.name, r.group, r.dep, r.share, r.share0, r.merger]) },
    draw: (width) => keyed(K.bars({
      width, unit: PCT, dp: 1, markName: monthOf(D.bsFirst) + ":",
      rows: D.biggest.map((r) => ({ name: r.name, value: r.share, mark: r.share0, color: FILL[r.group] ?? C.ctx2 })),
    }), [{ color: C.lead, label: "Public sector" }, { color: C.comp, label: "Private sector" }, { ring: true, label: monthOf(D.bsFirst) }]),
  });
}

/* § 06 net profit by group, each financial year */
export function profit() {
  const D = data();
  // the March figure covers April to March: dated at the financial year's start, read as 2013-14
  const fyStart = (iso) => `${+iso.slice(0, 4) - 1}-04-01`;
  const ser = (g) => D.profit.years.map((d, i) => [fyStart(d), D.profit[g][i] == null ? null : D.profit[g][i] / 1e5]);
  return figure({
    bare: true, file: "india-atlas_bank-profit-by-group",
    label: "Net profit after tax of public sector, private sector and foreign banks, each financial year, ₹ lakh crore: public sector banks in loss from 2015-16 to 2019-20",
    data: { cols: ["financial_year", ...["all", "psb", "private", "foreign", "sfb"].map((g) => `${g}_net_profit_inr_crore`)], rows: D.profit.years.map((d, j) => [`${+d.slice(0, 4) - 1}-${d.slice(2, 4)}`, ...["all", "psb", "private", "foreign", "sfb"].map((g) => D.profit[g][j])]) },
    draw: (width) => K.line({
      width, freq: "fy", unit: { prefix: "₹" }, endDp: 1, hoverDp: 2,
      endFormat: (v) => K.num(v, { dp: 1, prefix: "₹", suffix: phoneW(width) ? "" : " lakh crore" }),
      series: ["foreign", "private", "psb"].map((g) => ({ ...GROUP[g], data: ser(g) })),
    }),
  });
}

/* § 06 capital adequacy by group, with the minimum */
export function capital() {
  const D = data();
  return figure({
    bare: true, file: "india-atlas_bank-capital-by-group",
    label: "Capital adequacy ratio of India's banks by bank group, every quarter, against the RBI's minimum with the conservation buffer, 11.5%",
    data: joined(["all", "psb", "private", "foreign", "sfb"].map((g) => [`${g}_crar_pct`, hp(D, `${g}_crar`).filter(([, v]) => v != null)])),
    draw: (width) => K.line({
      width, freq: "month", unit: PCT, endDp: 2, hoverDp: 2, zero: false,
      series: ["foreign", "all", "private", "psb"].map((g) => groupLine(D, g, "crar")),
      refs: [{ y: 11.5, label: "Minimum with buffer, 11.5%" }],
    }),
  });
}

/* § 06 cost of funds, yield on funds, net interest margin */
export function margins() {
  const M = data().margins;
  return figure({
    bare: true, file: "india-atlas_bank-margins",
    label: "All banks' yield on funds, cost of funds and net interest margin, annualised, every quarter since December 2013",
    data: joined([["yield_on_funds_pct", M.yield], ["cost_of_funds_pct", M.cost], ["net_interest_margin_pct", M.nim]]),
    draw: (width) => K.line({
      width, freq: "month", unit: PCT, endDp: 2, hoverDp: 2,
      series: [
        { name: "Yield on funds", data: M.yield, role: "ctx" },
        { name: "Cost of funds", data: M.cost, role: "ctx", color: C.ink2 },
        { name: "Net interest margin", short: "Margin", data: M.nim, role: "lead" },
      ],
    }),
  });
}

/* § 07 bad loans of the twenty largest lenders, now and March 2018 */
export function bankNpa() {
  const D = data(), rows = D.lenders.filter((r) => r.now != null);
  const lab = (r) => (r.peak != null ? `${pct2(r.now)}, from ${pct2(r.peak)}` : pct2(r.now));
  return figure({
    bare: true, file: "india-atlas_bank-bad-loans-largest-banks",
    label: "Gross NPA ratio of the twenty largest banks by advances, latest quarter and March 2018",
    data: { cols: ["bank", "group", `gross_advances_${D.aqLatest}_inr_crore`, `gnpa_ratio_${D.aqLatest}_pct`, `gnpa_ratio_${D.peakIso}_pct`], rows: D.lenders.map((r) => [r.name, r.group, r.adv, r.now, r.peak]) },
    draw: (width) => K.dumbbell({
      width, sortBy: "none", unit: PCT, dp: 2, fmt: pct2, aColor: C.ink2,
      keys: { a: monthOf(D.peakIso), b: monthOf(D.aqLatest) },
      room: phoneW(width) ? 12 : Math.ceil(Math.max(...rows.map((r) => K.tw(lab(r), 12)))) + 16,
      endText: (r) => r.text,
      rows: rows.map((r) => ({ name: r.name, a: r.peak, b: r.now, text: lab(r) })),
    }),
  });
}

/* § 07 return on assets of the twenty largest lenders */
export function bankRoa() {
  const D = data(), rows = D.lenders.filter((r) => r.roa != null);
  const all = D.allRoa;
  return figure({
    bare: true, file: "india-atlas_bank-return-on-assets",
    label: "Return on assets of the twenty largest lenders, latest quarter, public and private sector banks",
    data: { cols: ["bank", "group", `return_on_assets_${D.aqLatest}_pct`, `net_interest_margin_${D.aqLatest}_pct`], rows: rows.slice().sort((a, b) => b.roa - a.roa).map((r) => [r.name, r.group, r.roa, r.nim]) },
    draw: (width) => keyed(K.bars({
      width, unit: PCT, dp: 2, ref: { value: all, label: `All banks ${pct2(all)}` },
      rows: rows.map((r) => ({ name: r.name, value: r.roa, color: FILL[r.group] ?? C.ctx2 })),
    }), [{ color: C.lead, label: "Public sector" }, { color: C.comp, label: "Private sector" }]),
  });
}

/* § 07 deposits of the banks that absorbed others; the merger quarters marked */
export function mergers() {
  const D = data();
  const ROLE = { state_bank_of_india: "lead", hdfc_bank_ltd: "comp" };
  return figure({
    bare: true, file: "india-atlas_bank-mergers-deposits",
    label: "Deposits in India of six banks that absorbed others, ₹ lakh crore, every quarter, with the quarters the mergers took effect",
    data: joined(D.mergers.map((m) => [`${m.id}_deposits_inr_lakh_crore`, m.data])),
    draw: (width) => K.line({
      width, freq: "month", unit: { prefix: "₹" }, endDp: 1, hoverDp: 2,
      endFormat: (v) => K.num(v, { dp: 1, prefix: "₹" }),
      series: D.mergers.slice().reverse().map((m) => ({ name: m.name, short: m.id === "punjab_national_bank" ? "PNB" : m.id === "union_bank_of_india" ? "Union Bank" : m.id === "bank_of_baroda" ? "Baroda" : m.name, data: m.data, role: ROLE[m.id] ?? "ctx" })),
      events: [
        { t: "2017-06-01", label: "SBI's associates", short: "SBI" },
        { t: "2019-06-01", label: "Vijaya, Dena", short: "BoB", side: "left" },
        { t: "2020-06-01", label: "PNB, Canara, Union", short: "PNB" },
        { t: "2023-09-01", label: "HDFC Ltd", short: "HDFC", side: "left" },
      ],
    }),
  });
}

/* § 08 bad loans by sector of the borrower */
export function sectorNpa() {
  const D = data(), S = Object.fromEntries(D.sector.map((s) => [s.name, s]));
  const ROLE = { Industry: "lead", "Retail loans": "comp", Agriculture: "ctx", Services: "ctx2" };
  return figure({
    bare: true, file: "india-atlas_bad-loans-by-sector",
    label: "Gross NPA ratio by sector of the borrower, all banks, every quarter: industry, agriculture, services and retail loans",
    data: joined([...D.sector.map((s) => [`${s.k}_pct`, s.data]), ["priority_sector_gnpa_ratio_pct", D.priority.psl], ["other_than_priority_gnpa_ratio_pct", D.priority.non], ["priority_mse_gnpa_ratio_pct", D.priority.mse]]),
    draw: (width) => K.line({
      width, freq: "month", unit: PCT, endDp: 2, hoverDp: 2,
      series: ["Services", "Agriculture", "Retail loans", "Industry"].map((n) => ({ name: n, short: n === "Retail loans" ? "Retail" : n, data: S[n].data, role: ROLE[n] })),
    }),
  });
}

/* § 08 bad loans by type of retail loan: latest (bar), highest since 2013 (ring) */
export function retailNpa() {
  const D = data();
  return figure({
    bare: true, file: "india-atlas_bad-loans-retail",
    label: "Gross NPA ratio of retail loans by type, latest quarter and the highest quarter since 2013",
    data: { cols: ["loan_type", `gnpa_ratio_${D.sectorLatest}_pct`, "highest_since_2013_pct", `gross_advances_${D.sectorLatest}_inr_crore`], rows: D.retail.map((r) => [r.name, r.ratio, r.peak, r.adv]) },
    draw: (width) => K.bars({
      width, unit: PCT, dp: 2, markName: "highest since 2013", markFmt: (v) => "highest " + pct2(v),
      rows: D.retail.filter((r) => r.ratio != null).map((r) => ({ name: r.name, value: r.ratio, mark: r.peak, highlight: true })),
    }),
  });
}

/* § 08 infrastructure lending by sector */
export function infra() {
  const D = data();
  return figure({
    bare: true, file: "india-atlas_bank-infrastructure-lending",
    label: "Bank lending to infrastructure by sector, latest quarter, ₹ lakh crore",
    data: { cols: ["sector", `outstanding_${D.infraLatest}_inr_crore`], rows: D.infra.map((r) => [r.name, r.v]) },
    draw: (width) => K.bars({
      width, dp: 2, unit: { prefix: "₹" }, nameMax: 280,
      fmt: (v) => K.num(v, { dp: 2, prefix: "₹", suffix: phoneW(width) ? " lakh cr" : " lakh crore" }),
      rows: D.infra.map((r, i) => ({ name: r.name, value: r.v / 1e5, highlight: i === 0 })),
    }),
  });
}

/* § 09 branches by population group since 1969 */
export function branches() {
  const D = data(), B = Object.fromEntries(D.branches.map((b) => [b.k, b]));
  const ROLE = { rural: "lead", semi_urban: "comp", urban: "ctx", metropolitan: "ctx2" };
  return figure({
    bare: true, file: "india-atlas_bank-branches-by-place",
    label: "Branches of scheduled commercial banks by population group, every March since 1969: rural, semi-urban, urban and metropolitan",
    data: joined(D.branches.map((b) => [b.k, b.data])),
    draw: (width) => K.line({
      width, freq: "year", endDp: 0, hoverDp: 0,
      series: ["metropolitan", "urban", "semi_urban", "rural"].map((k) => ({ name: B[k].name, data: B[k].data, role: ROLE[k] })),
    }),
  });
}

/* § 09 branches by bank group: latest (bar), first quarter in the table (ring) */
export function offices() {
  const D = data();
  const rows = D.offices.map((r) => ({ ...r, name: r.name.replace(/, Branch$/, "") }));
  return figure({
    bare: true, file: "india-atlas_bank-branches-by-group",
    label: `Functioning bank branches by bank group, ${monthOf(D.officesLatest)} and ${monthOf(D.officesFirst)}`,
    data: { cols: ["bank_group", `branches_${D.officesLatest}`, `branches_${D.officesFirst}`], rows: rows.map((r) => [r.name, r.v, r.v0]) },
    draw: (width) => K.bars({
      width, dp: 0, markName: monthOf(D.officesFirst) + ":", markFmt: (v) => `${K.num(v, { dp: 0 })} in ${D.officesFirst.slice(0, 4)}`,
      rows: rows.map((r) => ({ name: r.name, value: r.v, mark: r.v0, highlight: /^(public|private)/.test(r.k) })),
    }),
  });
}

/* § 10 urban co-operative banks: how many (columns), their bad loans against commercial banks' */
export function ucb() {
  const D = data();
  return figure({
    bare: true, file: "india-atlas_urban-cooperative-banks",
    label: "Urban co-operative banks: their number each March, and their gross NPA ratio against all scheduled commercial banks'",
    data: joined([["ucbs_all", D.ucbCount.all], ["ucbs_scheduled", D.ucbCount.scheduled], ["ucbs_non_scheduled", D.ucbCount.non], ["ucb_gnpa_ratio_pct", D.ucbNpa.all], ["ucb_scheduled_gnpa_ratio_pct", D.ucbNpa.scheduled], ["ucb_non_scheduled_gnpa_ratio_pct", D.ucbNpa.non], ["scb_gnpa_ratio_march_pct", D.scbMarchNpa]]),
    draw: (width) => panels(width, [{ title: "Number of banks", k: "n" }, { title: "Gross NPA ratio", k: "npa" }], (p, pw) => p.k === "n"
      ? K.columns({ width: pw, height: phoneW(pw) ? 230 : 330, data: D.ucbCount.all, freq: "year", valueDp: 0 })
      : K.line({
        width: pw, height: phoneW(pw) ? 230 : 330, freq: "year", unit: PCT, endDp: 2, hoverDp: 2,
        series: [
          { name: "Scheduled commercial banks", short: "Commercial banks", data: D.scbMarchNpa, role: "ctx" },
          { name: "Urban co-operative banks", short: "UCBs", data: D.ucbNpa.all, role: "lead" },
        ],
      })),
  });
}

/* § 10 UCB deposits by state */
export function ucbStates() {
  const D = data(), rows = D.ucbStates.slice(0, 12);
  return figure({
    bare: true, file: "india-atlas_urban-cooperative-banks-by-state",
    label: "Deposits of urban co-operative banks by state, the twelve largest, ₹ crore, with each state's number of banks",
    data: { cols: ["state", `deposits_${D.ucbStatesLatest}_inr_crore`, "ucbs", "branches"], rows: D.ucbStates.map((r) => [r.name, r.dep, r.ucbs, r.branches]) },
    draw: (width) => K.bars({
      width, dp: 0, unit: { prefix: "₹" }, fmt: (v) => K.num(v, { dp: 0, prefix: "₹" }) + " crore",
      tickFmt: (v) => K.num(v, { dp: 0 }),
      rows: rows.map((r, i) => ({ name: r.name, value: r.dep, highlight: i === 0, note: r.ucbs == null ? null : `${r.ucbs} ${r.ucbs === 1 ? "bank" : "banks"}` })),
    }),
  });
}

/* § 10 UCBs by supervisory rating */
export function ucbRatings() {
  const D = data();
  return figure({
    bare: true, file: "india-atlas_urban-cooperative-banks-ratings",
    label: "Urban co-operative banks by the RBI's supervisory rating, A best to E worst, number of banks",
    data: { cols: ["rating", `ucbs_${D.ucbRatingsLatest}`, "", "crar_band", `ucbs_${D.ucbCrarLatest}`], rows: D.ucbRatings.map((r, i) => [r.r, r.v, null, D.ucbCrar[i]?.band ?? null, D.ucbCrar[i]?.v ?? null]) },
    draw: (width) => K.bars({
      width, dp: 0, sort: false,
      rows: D.ucbRatings.map((r) => ({ name: `Rating ${r.r}`, value: r.v, highlight: r.r === "D" || r.r === "E" })),
    }),
  });
}

/* § 11 NBFC credit by sector */
export function nbfc() {
  const D = data(), N = Object.fromEntries(D.nbfc.map((r) => [r.k, r.v]));
  const KEYS = [["retail_loans", "Retail loans"], ["industry", "Industry"], ["services", "Services"], ["agriculture_and_allied_activities", "Agriculture"], ["other_loans", "Other loans"]];
  return figure({
    bare: true, file: "india-atlas_nbfc-credit-by-sector",
    label: "Credit outstanding from non-banking financial companies by sector, ₹ lakh crore, the latest month",
    data: { cols: ["sector", `credit_${D.nbfcLatest}_inr_lakh_crore`], rows: D.nbfc.map((r) => [r.name, r.v]) },
    draw: (width) => K.bars({
      width, dp: 1, fmt: (v) => K.num(v, { dp: 1, prefix: "₹" }) + " lakh crore",
      rows: KEYS.filter(([k]) => N[k] != null).map(([k, name], i) => ({ name, value: N[k], highlight: i === 0 })),
    }),
  });
}

/* § 11 the development banks' balance sheets */
export function fi() {
  const D = data();
  const ROLE = { NABARD: "lead", SIDBI: "ctx", "EXIM Bank": "ctx", NHB: "ctx2" };
  return figure({
    bare: true, file: "india-atlas_development-banks",
    label: "Total liabilities of NABARD, SIDBI, EXIM Bank and NHB, ₹ lakh crore, each 31 March",
    data: joined(D.fi.map((f) => [`${f.name}_total_liabilities_inr_lakh_crore`, f.data])),
    draw: (width) => K.line({
      width, freq: "year", unit: { prefix: "₹" }, endDp: 1, hoverDp: 2,
      series: D.fi.slice().reverse().map((f) => ({ name: f.name, data: f.data, role: ROLE[f.name] })),
    }),
  });
}

/* § 11 share of deposits insured */
export function insured() {
  const D = data();
  const sh = D.insured.map(([d, ins, ass]) => [d, Math.round((1000 * ins) / ass) / 10]);
  return figure({
    bare: true, file: "india-atlas_deposit-insurance",
    label: "Insured deposits as a share of assessable deposits, each date DICGC reports since 1961; the cover was raised to ₹5 lakh in February 2020",
    data: { cols: ["date", "insured_deposits_inr_crore", "assessable_deposits_inr_crore", "insured_share_pct", "fully_protected_accounts", "all_accounts"], rows: D.insured.map(([d, a, b, c, e]) => [d, a, b, +((100 * a) / b).toFixed(2), c, e]) },
    draw: (width) => K.line({
      width, freq: "month", unit: PCT, endDp: 1, yDomain: [0, 100],
      series: [{ name: "Insured share", data: sh, role: "lead" }],
      events: [{ t: "2020-02-01", label: "Cover raised to ₹5 lakh", short: "₹5 lakh cover", side: "left" }],
    }),
  });
}
