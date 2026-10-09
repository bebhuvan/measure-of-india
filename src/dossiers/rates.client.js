// Guide 15, interest rates and monetary policy: plates and number wiring.
// Data: data/series/rates-*.json, baked by scripts/lib/products/rbirates.mjs from the Data
// Bank's mirror of RBI publications. Small bundles are imported here; the heavy ones (weekly
// rates, T-bill auctions, the yield curve, bank-wise MCLR) are sliced at build time by the page
// and handed over as baked JSON (#rates-baked), so the page makes no data requests.
// Separate rulers are never joined: Bank Rate and repo rate; reverse repo and SDF as the floor;
// deposit rates of all banks (to 1999-00) and five major banks (from 2000-01); CPI 2024=100
// back-cast and live (the NSO's link, drawn with the shared seam treatment).

import * as Plot from "@observablehq/plot";
import policyB from "../../data/series/rates-policy.json";
import monthlyB from "../../data/series/rates-monthly.json";
import mpcB from "../../data/series/rates-mpc.json";
import votesB from "../../data/series/rates-mpc-votes.json";
import lendB from "../../data/series/rates-lending.json";
import benchB from "../../data/series/rates-benchmarks.json";
import sectB from "../../data/series/rates-walr-sectors.json";
import occB from "../../data/series/rates-walr-occupation.json";
import mclrB from "../../data/series/rates-mclr.json";
import realB from "../../data/series/rates-real.json";
import callmB from "../../data/series/rates-call-monthly.json";
import borrowB from "../../data/series/rates-borrowing.json";
import devB from "../../data/series/rates-gsec-auctions-fy.json";
import sdlB from "../../data/series/rates-sdl-states.json";
import structB from "../../data/series/rates-structure.json";
import { MONO as sans, a11y, addCrosshair, spark, dodgeEndLabels, downloadSVG, downloadPNG, saveBlob, seamMarks, fmt } from "../charts/plumbing.js";

const BK = JSON.parse(document.getElementById("rates-baked")?.textContent || "{}");
const INK = "#161A22", GRID = "#F0F2F5", BASE = "#D3D7DE", MUTED = "#878D99";
const ACC = "#2E4BD8", ACC_SOFT = "#AFBBF0", GOLD = "#C47A16", GOLD_SOFT = "#E8C79A", G1 = "#5F6675", G2 = "#A3A9B4", G3 = "#C9CED6";
const W = 1184;
const MS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const ML = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const dt = (iso) => new Date(iso + "T00:00:00Z");
const longDay = (iso) => `${+iso.slice(8, 10)} ${ML[+iso.slice(5, 7) - 1]} ${iso.slice(0, 4)}`;
const monthOf = (d) => MS[d.getUTCMonth()] + " " + d.getUTCFullYear();
const dayOf = (d) => `${d.getUTCDate()} ${MS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
const setHTML = (id, h) => { const el = document.getElementById(id); if (el) el.innerHTML = h; };
const pc = (u) => `<span class="pc">${u}</span>`;
const p2 = fmt.pct2, pt2 = (v) => (v < 0 ? "−" : "+") + Math.abs(v).toFixed(2) + " pt";
const sp = (v) => (v < 0 ? "−" : "") + Math.abs(v).toFixed(2) + "%";       // a signed rate (real rates)
const lastOf = (b, k) => { const d = b.series[k].data; for (let i = d.length - 1; i >= 0; i--) if (d[i] != null) return { v: d[i], i, date: b.dates[i] }; return null; };
const at = (b, k, iso) => { const i = b.dates.indexOf(iso); return i < 0 ? null : b.series[k].data[i]; };
const pts = (b, k, from) => b.dates.map((d, i) => ({ date: dt(d), value: b.series[k].data[i] })).filter((p) => !from || p.date >= dt(from));
const style = { background: "transparent", fontFamily: sans, fontSize: "12px", color: MUTED, overflow: "visible" };
const yearTicks = (a, b, step) => { const t = []; for (let y = a; y <= b; y += step) t.push(new Date(Date.UTC(y, 0, 1))); return t; };
const yearFmt = (d) => String(d.getUTCFullYear());
// a y (or x) domain that admits every published value, rounded out to whole steps
function span(values, step, floor0 = true) {
  const v = values.filter((x) => x != null && Number.isFinite(x));
  const lo = floor0 ? Math.min(0, Math.floor(Math.min(...v) / step) * step) : Math.floor(Math.min(...v) / step) * step;
  const hi = Math.ceil(Math.max(...v) / step) * step;
  const ticks = []; for (let t = lo; t <= hi + 1e-9; t += step) ticks.push(Math.round(t * 1000) / 1000);
  return { domain: [lo, hi], ticks };
}
const vals = (...lists) => lists.flatMap((l) => l.map((p) => (typeof p === "number" || p == null ? p : p.value)));

// policy rates as steps: each level holds until the next change; the line ends on the last date
function steps(dates, values, end) {
  const out = [];
  for (let i = 0; i < dates.length; i++) {
    const v = values[i];
    if (v == null) { if (out.length && out.at(-1).value != null) out.push({ date: dt(dates[i]), value: out.at(-1).value }, { date: dt(dates[i]), value: null }); continue; }
    if (out.length && out.at(-1).value != null) out.push({ date: dt(dates[i]), value: out.at(-1).value });
    out.push({ date: dt(dates[i]), value: v });
  }
  if (end && out.length && out.at(-1).value != null) out.push({ date: end, value: out.at(-1).value });
  return out;
}

function wirePlate(id, plot, filename, csv) {
  const el = document.getElementById(id);
  if (!el || !plot) return;
  const meta = { title: el.querySelector(".plate-head h3")?.textContent.trim(), sub: el.querySelector(".plate-head .sub")?.textContent.trim(), foot: el.querySelector(".plotfoot .src")?.textContent.trim().replace(/\s+/g, " ") };
  el.querySelectorAll("[data-dl]").forEach((b) => b.addEventListener("click", () => {
    if (b.dataset.dl === "svg") downloadSVG(plot, filename, meta);
    if (b.dataset.dl === "png") downloadPNG(plot, filename, meta);
    if (b.dataset.dl === "csv") saveBlob(new Blob([csv], { type: "text/csv" }), filename + ".csv");
  }));
}
const csvOf = (header, rows) => header.join(",") + "\n" + rows.map((r) => r.map((v) => (v == null ? "" : /[",]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : v)).join(",")).join("\n");
const put = (id, plot) => { document.getElementById(id)?.append(plot); return plot; };
// end labels on the right margin, dodged so they never overlap
function endLabels(list, gap, f) {
  const dodged = dodgeEndLabels(list, gap);
  return dodged.map((p) => Plot.text([{ date: p.s.data.filter((d) => d.value != null).at(-1).date, value: p.y }], { x: "date", y: "value", text: () => `${p.s.label} ${f(p.value)}`, dx: 10, textAnchor: "start", fill: INK, fontSize: 12, fontWeight: p.s.bold ? 600 : 400 }));
}

/* =================== title block and § 01 =================== */
const M = mpcB.meta.meetings, lastM = M.at(-1), prevRepo = mpcB.series.repo.data.at(-2);
const repo = lastOf(monthlyB, "repo").v;
const STANCE = { accommodative: "Accommodative", neutral: "Neutral", calibrated_tightening: "Calibrated tightening", withdrawal_of_accommodation: "Withdrawal of accommodation", accommodative_focus_on_withdrawal: "Accommodative, focused on withdrawal" };
const chgBps = mpcB.series.change_bps.data.at(-1);
const bpsTxt = (b) => (b === 0 ? "no change" : `${b > 0 ? "+" : "−"}${Math.abs(b)} bp`);   // bp: hundredths of a percentage point
setHTML("m-decided", longDay(lastM.date));
setHTML("n-repo", repo.toFixed(2) + pc("%"));
setHTML("d-repo", `<b>${bpsTxt(chgBps)}</b> on ${longDay(lastM.date)}`);
spark("nspark-repo", { data: pts(monthlyB, "repo", "2016-10-01"), color: ACC });
const wf = lastOf(lendB, "walr_fresh_all"), df = lastOf(lendB, "wadtdr_fresh_all");
const lmonth = monthOf(dt(wf.date));
setHTML("n-walr", wf.v.toFixed(2) + pc("%"));
setHTML("d-walr", `<b>${pt2(wf.v - lendB.series.walr_fresh_all.data[wf.i - 12])}</b> on a year earlier, ${lmonth}`);
setHTML("n-fd", df.v.toFixed(2) + pc("%"));
setHTML("d-fd", `<b>${pt2(df.v - lendB.series.wadtdr_fresh_all.data[df.i - 12])}</b> on a year earlier, ${lmonth}`);
const rr = lastOf(realB, "repo"), cpiNow = lastOf(realB, "cpi");
setHTML("n-real", sp(rr.v).replace("%", pc("%")));
setHTML("d-real", `repo minus CPI inflation of <b>${p2(cpiNow.v)}</b>, ${monthOf(dt(rr.date))}`);
setHTML("rb-repo", repo.toFixed(2) + pc("%"));
setHTML("rb-stance", STANCE[lastM.stance] ?? "Not recorded");

/* =================== § 02 lived reality =================== */
{
  const house = lastOf(sectB, "fresh_housing").v;
  const emi = (r) => { const m = r / 1200, n = 240, P = 3000000; return (P * m * (1 + m) ** n) / ((1 + m) ** n - 1); };
  setHTML("lr-emi", fmt.inrR(emi(house + 1) - emi(house)));
  setHTML("lr-house", p2(house));
  setHTML("lr-fd", p2(lastOf(lendB, "wadtdr_fresh_all").v));
  setHTML("lr-cpi", p2(at(realB, "cpi", wf.date)));
  setHTML("lr-realfd", sp(at(realB, "fd_fresh", wf.date)));
}

/* =================== § 04 ninety years of policy rates =================== */
{
  const P = policyB, end = dt(P.dates.at(-1));
  const bank = { label: "Bank Rate", color: GOLD, data: steps(P.dates, P.series.bank_rate.data, end) };
  const rp = { label: "Repo rate", color: ACC, bold: true, data: steps(P.dates, P.series.repo.data, end) };
  const plot = Plot.plot({
    width: W, height: 470, marginLeft: 44, marginRight: 170, marginTop: 28, marginBottom: 34, style,
    x: { type: "utc", label: null, tickSize: 0, tickPadding: 10, ticks: yearTicks(1940, 2020, 10).concat([dt("2026-01-01")]), tickFormat: yearFmt },
    y: { label: "per cent a year", labelAnchor: "top", labelArrow: false, domain: [0, 14], ticks: [0, 2, 4, 6, 8, 10, 12, 14], tickSize: 0, tickPadding: 8, tickFormat: (v) => String(v) },
    marks: [
      Plot.gridY([2, 4, 6, 8, 10, 12, 14], { stroke: GRID }),
      Plot.ruleY([0], { stroke: BASE }),
      ...seamMarks("side", [{ data: bank.data, color: GOLD, width: 1.75 }, { data: rp.data, color: ACC, width: 2 }], { text: "Repo auctions begin, April 2001", y: 13.2, at: dt(P.dates[P.series.repo.data.findIndex((v) => v != null)]) }),
      ...endLabels([rp, bank], 0.75, p2),
    ],
  });
  const rs = P.series.repo.data.filter((v) => v != null);
  a11y(plot, "The Bank Rate since 1935 and the repo rate since 2001", `Repo rate ${p2(repo)} after ${longDay(lastM.date)}; Bank Rate ${p2(P.series.bank_rate.data.at(-1))}.`);
  put("plot-long", plot);
  setHTML("pv-long", p2(repo));
  setHTML("ex-long-repo", p2(repo));
  setHTML("ex-long-chg", bpsTxt(chgBps));
  setHTML("ex-long-bank", p2(P.series.bank_rate.data.at(-1)));
  setHTML("ex-long-min", p2(Math.min(...rs)));
  setHTML("ex-long-max", p2(Math.max(...rs)));
  wirePlate("cb-long", plot, "india-atlas_policy-rates-since-1935", csvOf(["date_of_change", ...Object.keys(P.series).map((k) => P.series[k].name)], P.dates.map((d, i) => [d, ...Object.keys(P.series).map((k) => P.series[k].data[i])])));
}

/* =================== § 04 the corridor =================== */
{
  const X = BK.wss; const D = X.dates;
  const ser = (k, label, color) => ({ label, color, data: D.map((d, i) => ({ date: dt(d), value: X.series[k][i] })) });
  const call = ser("call", "Call rate", ACC), rp = ser("repo", "Repo", INK), msf = ser("msf", "Ceiling (MSF)", G2);
  const sdfStart = D.findIndex((d, i) => X.series.sdf[i] != null && d >= "2022-04-01");
  const rev = { label: "Floor", color: G2, data: D.map((d, i) => ({ date: dt(d), value: i < sdfStart || sdfStart < 0 ? X.series.reverse_repo[i] : null })) };
  const ySpan = span(vals(X.series.call, X.series.msf, X.series.reverse_repo, X.series.sdf), 2, false);
  const sdf = { label: "Floor (SDF)", color: G2, data: D.map((d, i) => ({ date: dt(d), value: i >= sdfStart && sdfStart >= 0 ? X.series.sdf[i] : null })) };
  const plot = Plot.plot({
    width: W, height: 470, marginLeft: 44, marginRight: 150, marginTop: 28, marginBottom: 34, style,
    x: { type: "utc", label: null, tickSize: 0, tickPadding: 10, ticks: yearTicks(2012, 2026, 2), tickFormat: yearFmt },
    y: { label: "per cent a year", labelAnchor: "top", labelArrow: false, ...ySpan, tickSize: 0, tickPadding: 8, tickFormat: (v) => String(v) },
    marks: [
      Plot.gridY(ySpan.ticks.slice(1), { stroke: GRID }),
      Plot.lineY(msf.data, { x: "date", y: "value", stroke: G2, strokeWidth: 1.25 }),
      ...seamMarks("side", [{ data: rev.data, color: G2, width: 1.25 }, { data: sdf.data, color: G2, width: 1.25 }], { text: "SDF becomes the floor", y: ySpan.domain[1] - 0.6, at: sdfStart >= 0 ? dt(D[sdfStart]) : undefined }),
      Plot.lineY(rp.data, { x: "date", y: "value", stroke: INK, strokeWidth: 1.25 }),
      Plot.lineY(call.data, { x: "date", y: "value", stroke: ACC, strokeWidth: 1.5, strokeLinejoin: "round" }),
      ...endLabels([{ ...call, bold: true }, rp, msf, { ...sdf, label: "Floor" }], 0.32, p2),
    ],
  });
  a11y(plot, "The call money rate inside the RBI's corridor, weekly since 2011", `Latest week ${dayOf(dt(D.at(-1)))}: call rate ${p2(X.series.call.at(-1))}, repo ${p2(X.series.repo.at(-1))}.`);
  put("plot-corridor", plot);
  addCrosshair(document.getElementById("plot-corridor"), plot, [call, rp, msf, { ...rev, data: rev.data.map((p, i) => ({ date: p.date, value: p.value ?? sdf.data[i].value })) }], null, dayOf);
  setHTML("pv-corr", p2(X.series.call.at(-1)));
  setHTML("ex-corr-call", p2(X.series.call.at(-1)));
  setHTML("ex-corr-repo", p2(X.series.repo.at(-1)));
  setHTML("ex-corr-floor", p2(X.series.sdf.at(-1)));
  wirePlate("cb-corridor", plot, "india-atlas_rbi-corridor-weekly", csvOf(["week", "call_wa_pct", "repo_pct", "msf_pct", "reverse_repo_pct", "sdf_pct"], D.map((d, i) => [d, X.series.call[i], X.series.repo[i], X.series.msf[i], X.series.reverse_repo[i], X.series.sdf[i]])));
}

/* =================== § 04 reserve requirements =================== */
{
  const P = policyB, end = dt(P.dates.at(-1));
  const crr = { label: "CRR", color: ACC, bold: true, data: steps(P.dates, P.series.crr.data, end) };
  const slr = { label: "SLR", color: G1, data: steps(P.dates, P.series.slr.data, end) };
  const plot = Plot.plot({
    width: W, height: 430, marginLeft: 44, marginRight: 110, marginTop: 28, marginBottom: 34, style,
    x: { type: "utc", label: null, tickSize: 0, tickPadding: 10, ticks: yearTicks(1940, 2020, 10).concat([dt("2026-01-01")]), tickFormat: yearFmt },
    y: { label: "per cent of deposits", labelAnchor: "top", labelArrow: false, domain: [0, 40], ticks: [0, 10, 20, 30, 40], tickSize: 0, tickPadding: 8, tickFormat: (v) => String(v) },
    marks: [
      Plot.gridY([10, 20, 30, 40], { stroke: GRID }),
      Plot.ruleY([0], { stroke: BASE }),
      Plot.lineY(slr.data, { x: "date", y: "value", stroke: G1, strokeWidth: 1.75 }),
      Plot.lineY(crr.data, { x: "date", y: "value", stroke: ACC, strokeWidth: 2 }),
      ...endLabels([crr, slr], 2.5, (v) => v.toFixed(2) + "%"),
    ],
  });
  let peak = 0; P.dates.forEach((d, i) => { const s = (P.series.crr.data[i] ?? 0) + (P.series.slr.data[i] ?? 0); if (s > peak) peak = s; });
  a11y(plot, "Cash reserve ratio and statutory liquidity ratio since 1935", `CRR ${P.series.crr.data.at(-1)}%, SLR ${P.series.slr.data.at(-1)}% now; together ${peak}% at their peak.`);
  put("plot-reserve", plot);
  setHTML("pv-res", fmt.pct2(P.series.crr.data.at(-1) + P.series.slr.data.at(-1)));
  setHTML("ex-res-crr", fmt.pct2(P.series.crr.data.at(-1)));
  setHTML("ex-res-slr", fmt.pct2(P.series.slr.data.at(-1)));
  setHTML("ex-res-peak", fmt.pct1(peak));
  wirePlate("cb-reserve", plot, "india-atlas_crr-slr-since-1935", csvOf(["date_of_change", "crr_pct", "slr_pct"], P.dates.map((d, i) => [d, P.series.crr.data[i], P.series.slr.data[i]])));
}

/* =================== § 05 every MPC decision =================== */
{
  const rows = M.map((m, i) => ({ date: dt(m.date), bps: mpcB.series.change_bps.data[i], repo: mpcB.series.repo.data[i], d: m.decision }));
  const plot = Plot.plot({
    width: W, height: 380, marginLeft: 48, marginRight: 30, marginTop: 28, marginBottom: 34, style,
    x: { type: "utc", label: null, tickSize: 0, tickPadding: 10, ticks: yearTicks(2017, 2026, 1), tickFormat: yearFmt },
    y: { label: "change in the repo rate, bp (hundredths of a point)", labelAnchor: "top", labelArrow: false, domain: [-80, 60], ticks: [-75, -50, -25, 0, 25, 50], tickSize: 0, tickPadding: 8, tickFormat: (v) => (v > 0 ? "+" : "") + v },
    marks: [
      Plot.gridY([-75, -50, -25, 25, 50], { stroke: GRID }),
      Plot.ruleY([0], { stroke: BASE }),
      Plot.ruleX(rows.filter((r) => r.bps !== 0), { x: "date", y1: 0, y2: "bps", stroke: (r) => (r.bps < 0 ? ACC : GOLD), strokeWidth: 7 }),
      Plot.dot(rows.filter((r) => r.bps === 0), { x: "date", y: 0, r: 3.5, fill: "#fff", stroke: MUTED, strokeWidth: 1.5 }),
    ],
  });
  a11y(plot, "Every Monetary Policy Committee decision since October 2016", `${rows.length} meetings: ${M.filter((m) => m.decision === "hold").length} holds, ${M.filter((m) => m.decision === "cut").length} cuts, ${M.filter((m) => m.decision === "hike").length} hikes.`);
  put("plot-mpc", plot);
  setHTML("pv-mpc", (chgBps > 0 ? "+" : chgBps < 0 ? "−" : "") + Math.abs(chgBps) + pc(" bp"));
  setHTML("ex-mpc-n", String(M.length));
  setHTML("ex-mpc-hold", String(M.filter((m) => m.decision === "hold").length));
  setHTML("ex-mpc-cut", String(M.filter((m) => m.decision === "cut").length));
  setHTML("ex-mpc-hike", String(M.filter((m) => m.decision === "hike").length));
  setHTML("ex-mpc-last", bpsTxt(chgBps));
  setHTML("ex-mpc-stance", (STANCE[lastM.stance] ?? "not recorded").toLowerCase());
  wirePlate("cb-mpc", plot, "india-atlas_mpc-decisions", csvOf(["meeting_end", "meeting_no", "decision", "change_bps", "repo_pct", "stance", "votes_for", "votes_against"], M.map((m, i) => [m.date, m.n, m.decision, rows[i].bps, rows[i].repo, m.stance, m.votesFor, m.votesAgainst])));
}

/* =================== § 05 every member's vote =================== */
{
  const V = votesB, mem = V.meta.members;
  const role = (r) => (r === "External member" ? "external" : r === "Governor" ? "Governor" : r === "Deputy Governor" ? "Deputy Governor" : r === "Executive Director" ? "RBI officer" : "");
  const name = (m) => `${m.name}${role(m.role) ? ", " + role(m.role) : ""}`;
  const cells = [];
  mem.forEach((m) => V.dates.forEach((d, i) => { const v = V.series[m.key]?.data[i]; if (v != null) cells.push({ x: dt(d), y: name(m), v }); }));
  const plot = Plot.plot({
    width: W, height: 40 + mem.length * 24, marginLeft: 300, marginRight: 24, marginTop: 10, marginBottom: 30, style,
    x: { type: "utc", label: null, tickSize: 0, tickPadding: 8, ticks: yearTicks(2017, 2026, 1), tickFormat: yearFmt },
    y: { label: null, domain: mem.map(name), tickSize: 0, tickPadding: 12 },
    marks: [
      Plot.dot(cells.filter((c) => c.v === 1), { x: "x", y: "y", r: 3, fill: G3 }),
      Plot.dot(cells.filter((c) => c.v === 0), { x: "x", y: "y", r: 4.5, fill: ACC }),
    ],
  });
  const against = V.series.votes_against.data.reduce((a, b) => a + b, 0);
  a11y(plot, "How each MPC member voted at every meeting", `${against} votes against the decision across ${V.dates.length} meetings.`);
  put("plot-votes", plot);
  setHTML("pv-votes", String(against));
  setHTML("ex-votes-n", String(V.dates.length));
  setHTML("ex-votes-against", String(against));
  setHTML("ex-votes-last", `${V.series.votes_for.data.at(-1)} to ${V.series.votes_against.data.at(-1)}`);
  wirePlate("cb-votes", plot, "india-atlas_mpc-votes", csvOf(["meeting_end", ...mem.map((m) => m.name)], V.dates.map((d, i) => [d, ...mem.map((m) => V.series[m.key]?.data[i] == null ? "" : V.series[m.key].data[i] === 1 ? "with" : "against")])));
}

/* =================== § 06 transmission =================== */
{
  const L = lendB;
  const ser = (k, label, color, bold) => ({ label, color, bold, data: pts(L, k) });
  const S = [ser("walr_fresh_all", "New loans", ACC, true), ser("walr_outstanding_all", "All loans", ACC_SOFT), ser("wadtdr_fresh_all", "New deposits", GOLD), ser("wadtdr_outstanding_all", "All deposits", GOLD_SOFT)];
  const rp = { label: "Repo rate", color: INK, data: monthlyB.dates.map((d, i) => ({ date: dt(d), value: monthlyB.series.repo.data[i] })).filter((p) => p.date >= dt(L.dates[0]) && p.date <= dt(L.dates.at(-1))) };
  const pSpan = span(vals(...S.map((x) => x.data), rp.data), 2);
  const plot = Plot.plot({
    width: W, height: 500, marginLeft: 44, marginRight: 170, marginTop: 28, marginBottom: 34, style,
    x: { type: "utc", label: null, tickSize: 0, tickPadding: 10, ticks: yearTicks(2013, 2026, 1), tickFormat: (d) => (d.getUTCFullYear() % 2 ? "" : yearFmt(d)) },
    y: { label: "per cent a year", labelAnchor: "top", labelArrow: false, ...pSpan, tickSize: 0, tickPadding: 8, tickFormat: (v) => String(v) },
    marks: [
      Plot.gridY(pSpan.ticks.slice(1), { stroke: GRID }),
      Plot.lineY(rp.data, { x: "date", y: "value", stroke: INK, strokeWidth: 1.25 }),
      ...S.slice().reverse().map((s) => Plot.lineY(s.data, { x: "date", y: "value", stroke: s.color, strokeWidth: s.bold ? 2 : 1.6, strokeLinejoin: "round" })),
      ...endLabels([...S, rp], 0.42, p2),
    ],
  });
  a11y(plot, "Bank lending and deposit rates against the repo rate, monthly since 2012", `New loans ${p2(wf.v)}, new deposits ${p2(df.v)} in ${lmonth}.`);
  put("plot-pass", plot);
  addCrosshair(document.getElementById("plot-pass"), plot, [...S, { ...rp, data: S[0].data.map((p) => ({ date: p.date, value: rp.data.find((q) => +q.date === +p.date)?.value ?? null })) }], null, monthOf);
  const i = L.dates.length - 1, j = i - 12, mi = monthlyB.dates.indexOf(L.dates[i]), mj = monthlyB.dates.indexOf(L.dates[j]);
  setHTML("pv-pass", p2(wf.v));
  setHTML("ex-pass-wf", p2(wf.v));
  setHTML("ex-pass-wo", p2(lastOf(L, "walr_outstanding_all").v));
  setHTML("ex-pass-df", p2(df.v));
  setHTML("ex-pass-do", p2(lastOf(L, "wadtdr_outstanding_all").v));
  setHTML("ex-pass-dwf", pt2(L.series.walr_fresh_all.data[i] - L.series.walr_fresh_all.data[j]));
  setHTML("ex-pass-ddf", pt2(L.series.wadtdr_fresh_all.data[i] - L.series.wadtdr_fresh_all.data[j]));
  setHTML("ex-pass-drepo", pt2(monthlyB.series.repo.data[mi] - monthlyB.series.repo.data[mj]));
  const keys = Object.keys(L.series);
  wirePlate("cb-pass", plot, "india-atlas_lending-deposit-rates", csvOf(["month", ...keys.map((k) => L.series[k].name), "repo_month_end_pct"], L.dates.map((d, ii) => [d, ...keys.map((k) => L.series[k].data[ii]), at(monthlyB, "repo", d)])));
}

/* =================== § 06 benchmarks =================== */
{
  const Bn = benchB;
  const G = [["eblr", "External benchmark", ACC], ["mclr", "MCLR", G2], ["base_rate", "Base rate", G3], ["others", "Others", "#E3E6EB"]];
  document.getElementById("legend-bench").innerHTML = G.map(([, l, c]) => `<span class="chip"><i style="background:${c}"></i>${l}</span>`).join("");
  const rows = []; Bn.dates.forEach((d, i) => G.forEach(([k, l]) => rows.push({ q: d.slice(0, 7), g: l, v: Bn.series["all_" + k].data[i] })));
  const qlab = (q) => MS[+q.slice(5, 7) - 1] + " " + q.slice(2, 4);
  const plot = Plot.plot({
    width: W, height: 400, marginLeft: 44, marginRight: 20, marginTop: 28, marginBottom: 34, style,
    x: { type: "band", label: null, tickSize: 0, tickPadding: 8, padding: 0.25, tickFormat: (q) => (q.endsWith("-03") ? "Mar " + q.slice(0, 4) : "") },
    y: { label: "share of floating-rate loans, per cent", labelAnchor: "top", labelArrow: false, domain: [0, 100], ticks: [0, 25, 50, 75, 100], tickSize: 0, tickPadding: 8, tickFormat: (v) => String(v) },
    color: { domain: G.map((g) => g[1]), range: G.map((g) => g[2]) },
    marks: [
      Plot.barY(rows, { x: "q", y: "v", fill: "g", order: G.map((g) => g[1]), insetLeft: 0.5, insetRight: 0.5 }),
      Plot.ruleY([0], { stroke: BASE }),
    ],
  });
  a11y(plot, "Floating-rate loans by benchmark, quarterly since 2019", `External benchmark ${p2(lastOf(Bn, "all_eblr").v)} of loans in ${qlab(Bn.dates.at(-1))}.`);
  put("plot-bench", plot);
  const l = (k) => p2(lastOf(Bn, k).v);
  setHTML("pv-bench", l("all_eblr"));
  setHTML("ex-bench-eblr", l("all_eblr")); setHTML("ex-bench-mclr", l("all_mclr")); setHTML("ex-bench-base", l("all_base_rate"));
  setHTML("ex-bench-psb", l("public_eblr")); setHTML("ex-bench-pvt", l("private_eblr"));
  const keys = Object.keys(Bn.series);
  wirePlate("cb-bench", plot, "india-atlas_loan-benchmarks", csvOf(["quarter_start", ...keys.map((k) => Bn.series[k].name)], Bn.dates.map((d, i) => [d, ...keys.map((k) => Bn.series[k].data[i])])));
}

/* =================== horizontal bars, one highlighted row =================== */
function hbars(id, rows, { valueFmt, hl, xMax, xTicks, label, prev, mr = 90, ml = 260 }) {
  const plot = Plot.plot({
    width: W, height: 44 + rows.length * 34, marginLeft: ml, marginRight: mr, marginTop: 24, marginBottom: 30, style,
    x: { label, labelAnchor: "right", labelArrow: false, domain: [0, xMax], ticks: xTicks, tickFormat: (v) => String(v), tickSize: 0, tickPadding: 8 },
    y: { label: null, domain: rows.map((r) => r.name), tickSize: 0, tickPadding: 14 },
    marks: [
      Plot.gridX(xTicks.slice(1), { stroke: GRID }),
      Plot.barX(rows, { y: "name", x: "v", fill: (d) => (hl(d) ? ACC : G3), insetTop: 9, insetBottom: 9 }),
      ...(prev ? [Plot.dot(rows.filter((r) => r.p != null), { y: "name", x: "p", r: 3.5, fill: "#fff", stroke: G1, strokeWidth: 1.5 })] : []),
      Plot.text(rows, { y: "name", x: (d) => Math.max(d.v, d.p ?? 0), text: (d) => valueFmt(d.v), dx: 10, textAnchor: "start", fill: INK, fontSize: 12, fontWeight: (d) => (hl(d) ? 600 : 400) }),
      Plot.ruleX([0], { stroke: BASE }),
    ],
  });
  document.getElementById(id)?.append(plot);
  return plot;
}

/* =================== § 06 what a new loan costs =================== */
{
  const Sx = sectB, i = Sx.dates.length - 1;
  const rows = Sx.meta.sectors.map((s) => ({ key: s.key, name: s.label, v: Sx.series["fresh_" + s.key].data[i], p: Sx.series["fresh_" + s.key].data[i - 12] })).filter((r) => r.v != null).sort((a, b) => b.v - a.v);
  const lSpan = span(rows.flatMap((r) => [r.v, r.p]), 2);
  const plot = hbars("plot-loans", rows, { valueFmt: p2, hl: (d) => d.key === "housing", xMax: lSpan.domain[1], xTicks: lSpan.ticks, label: "per cent a year", prev: true });
  a11y(plot, "Average rate on new loans by purpose", rows.map((r) => `${r.name} ${p2(r.v)}`).join(", "));
  const g = (k) => p2(Sx.series["fresh_" + k].data[i]);
  setHTML("lg-loans", monthOf(dt(Sx.dates[i])));
  setHTML("pv-loans", g("housing"));
  setHTML("ex-loans-house", g("housing")); setHTML("ex-loans-veh", g("vehicle")); setHTML("ex-loans-edu", g("education")); setHTML("ex-loans-pers", g("other_personal_loans")); setHTML("ex-loans-msme", g("msmes"));
  const keys = Object.keys(Sx.series);
  wirePlate("cb-loans", plot, "india-atlas_loan-rates-by-purpose", csvOf(["month", ...keys.map((k) => Sx.series[k].name)], Sx.dates.map((d, ii) => [d, ...keys.map((k) => Sx.series[k].data[ii])])));
}

/* =================== § 06 credit cards and other loans (BSR-1) =================== */
{
  const O = occB, i = O.dates.length - 1;
  const rows = Object.entries(O.series).filter(([k]) => !/^total_credit/.test(k)).map(([k, s]) => ({ key: k, name: s.label.replace(/^WALR on outstanding loans: /, ""), v: s.data[i] })).filter((r) => r.v != null).sort((a, b) => b.v - a.v);
  const plot = hbars("plot-cards", rows, { valueFmt: p2, hl: (d) => d.key === "personal_credit_cards", xMax: span(rows.map((r) => r.v), 10).domain[1], xTicks: span(rows.map((r) => r.v), 10).ticks, label: "per cent a year" });
  a11y(plot, "Average rate on outstanding loans by the borrower's occupation", rows.map((r) => `${r.name} ${p2(r.v)}`).join(", "));
  const g = (k) => p2(O.series[k].data[i]);
  setHTML("pv-cards", g("personal_credit_cards"));
  setHTML("ex-cards-card", g("personal_credit_cards")); setHTML("ex-cards-dur", g("consumer_durables")); setHTML("ex-cards-house", g("housing")); setHTML("ex-cards-all", g("total_credit"));
  const keys = Object.keys(O.series);
  wirePlate("cb-cards", plot, "india-atlas_loan-rates-by-occupation", csvOf(["as_on", ...keys.map((k) => O.series[k].name)], O.dates.map((d, ii) => [d, ...keys.map((k) => O.series[k].data[ii])])));
}

/* =================== § 06 MCLR bank by bank =================== */
{
  const latest = BK.banksDate, rows = (BK.banks || []).filter((b) => b.at === latest);
  const GR = [["public_sector", "Public sector banks"], ["private_sector", "Private banks"], ["foreign", "Foreign banks"]];
  const med = (xs) => { const s = xs.slice().sort((a, b) => a - b); const n = s.length; return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2; };
  const meds = GR.map(([g, l]) => ({ g: l, v: med(rows.filter((r) => r.group === g).map((r) => r.v)) }));
  const plot = Plot.plot({
    width: W, height: 230, marginLeft: 180, marginRight: 40, marginTop: 20, marginBottom: 34, style,
    x: { label: "1-year MCLR, per cent a year", labelAnchor: "right", labelArrow: false, ...span(rows.map((r) => r.v), 2), tickSize: 0, tickPadding: 8, tickFormat: (v) => String(v) },
    y: { label: null, domain: GR.map((g) => g[1]), tickSize: 0, tickPadding: 14 },
    marks: [
      Plot.gridX(span(rows.map((r) => r.v), 2).ticks.slice(1), { stroke: GRID }),
      Plot.dot(rows, { x: "v", y: (r) => GR.find((g) => g[0] === r.group)?.[1], r: 4, fill: G2, fillOpacity: 0.7 }),
      Plot.tickX(meds, { x: "v", y: "g", stroke: ACC, strokeWidth: 2.5 }),
    ],
  });
  a11y(plot, "One-year MCLR of every bank", meds.map((m) => `${m.g} median ${p2(m.v)}`).join(", "));
  put("plot-mclr", plot);
  const allMed = lastOf(mclrB, "all_median").v;
  setHTML("pv-mclr", p2(allMed));
  setHTML("ex-mclr-med", p2(allMed));
  setHTML("ex-mclr-psb", p2(lastOf(mclrB, "public_median").v)); setHTML("ex-mclr-pvt", p2(lastOf(mclrB, "private_median").v)); setHTML("ex-mclr-frn", p2(lastOf(mclrB, "foreign_median").v));
  wirePlate("cb-mclr", plot, "india-atlas_mclr-by-bank", csvOf(["bank", "group", "mclr_1y_pct", "month", "a_year_earlier_pct"], (BK.banks || []).map((b) => [b.bank, b.group, b.v, b.at, b.y])));
}

/* =================== § 06 what savers are offered =================== */
{
  const X = BK.wss, D = X.dates;
  const band = D.map((d, i) => ({ date: dt(d), lo: X.series.term_deposit_min[i], hi: X.series.term_deposit_max[i] })).filter((p) => p.lo != null && p.hi != null);
  const sb = { label: "Savings", color: G1, data: D.map((d, i) => ({ date: dt(d), value: X.series.savings_max[i] })) };
  const fd = { label: "New deposits", color: ACC, bold: true, data: pts(lendB, "wadtdr_fresh_all") };
  const top = { label: "Card rates, top", color: "#8F9FEC", data: band.map((p) => ({ date: p.date, value: p.hi })) };
  const plot = Plot.plot({
    width: W, height: 440, marginLeft: 44, marginRight: 170, marginTop: 28, marginBottom: 34, style,
    x: { type: "utc", label: null, tickSize: 0, tickPadding: 10, ticks: yearTicks(2012, 2026, 2), tickFormat: yearFmt },
    y: { label: "per cent a year", labelAnchor: "top", labelArrow: false, domain: [0, 12], ticks: [0, 2, 4, 6, 8, 10, 12], tickSize: 0, tickPadding: 8, tickFormat: (v) => String(v) },
    marks: [
      Plot.gridY([2, 4, 6, 8, 10, 12], { stroke: GRID }),
      Plot.areaY(band, { x: "date", y1: "lo", y2: "hi", fill: "#E7EBFC" }),
      Plot.ruleY([0], { stroke: BASE }),
      Plot.lineY(sb.data, { x: "date", y: "value", stroke: G1, strokeWidth: 1.5 }),
      Plot.lineY(fd.data, { x: "date", y: "value", stroke: ACC, strokeWidth: 2 }),
      ...endLabels([fd, sb, top], 0.45, p2),
    ],
  });
  a11y(plot, "Deposit rates advertised and paid, since 2011", `Card rates for more than a year ${p2(X.series.term_deposit_min.at(-1))} to ${p2(X.series.term_deposit_max.at(-1))}; new deposits earned ${p2(df.v)}.`);
  put("plot-savers", plot);
  setHTML("pv-savers", p2(X.series.term_deposit_max.at(-1)));
  setHTML("ex-sav-min", p2(X.series.term_deposit_min.at(-1)));
  setHTML("ex-sav-max", p2(X.series.term_deposit_max.at(-1)));
  setHTML("ex-sav-sb", X.series.savings_min.at(-1) === X.series.savings_max.at(-1) ? p2(X.series.savings_max.at(-1)) : `${p2(X.series.savings_min.at(-1))} to ${p2(X.series.savings_max.at(-1))}`);
  setHTML("ex-sav-fd", p2(df.v));
  wirePlate("cb-savers", plot, "india-atlas_deposit-rates", csvOf(["week", "term_deposit_over_1y_low_pct", "term_deposit_over_1y_high_pct", "savings_low_pct", "savings_high_pct"], D.map((d, i) => [d, X.series.term_deposit_min[i], X.series.term_deposit_max[i], X.series.savings_min[i], X.series.savings_max[i]])));
}

/* =================== § 07 real rates =================== */
{
  const R = realB, cut = dt("2025-01-01");
  const ser = (k, label, color) => ({ label, color, data: pts(R, k) });
  const S = [ser("fd_fresh", "New deposits", ACC), ser("fd_outstanding", "All deposits", G1), ser("repo", "Repo", GOLD)];
  const rSpan = span(vals(...S.map((x) => x.data)), 2);
  const plot = Plot.plot({
    width: W, height: 470, marginLeft: 44, marginRight: 170, marginTop: 28, marginBottom: 34, style,
    x: { type: "utc", label: null, tickSize: 0, tickPadding: 10, ticks: yearTicks(2014, 2026, 2), tickFormat: yearFmt },
    y: { label: "percentage points above inflation", labelAnchor: "top", labelArrow: false, ...rSpan, tickSize: 0, tickPadding: 8, tickFormat: (v) => (v > 0 ? "+" : v < 0 ? "−" : "") + Math.abs(v) },
    marks: [
      Plot.gridY(rSpan.ticks.filter((t) => t !== 0), { stroke: GRID }),
      Plot.ruleY([0], { stroke: "#9AA0AB" }),
      ...seamMarks("agency", S.slice().reverse().map((s) => ({ data: s.data, color: s.color, width: s.color === ACC ? 2 : 1.6, reconstructedUntil: cut })), { text: "NSO back-cast to here", y: rSpan.domain[1] - 0.8, at: cut }),
      ...endLabels(S, 0.55, sp),
    ],
  });
  a11y(plot, "Real interest rates on deposits and the repo rate, monthly since 2014", `New deposits ${sp(lastOf(R, "fd_fresh").v)} after inflation in ${monthOf(dt(lastOf(R, "fd_fresh").date))}.`);
  put("plot-real", plot);
  addCrosshair(document.getElementById("plot-real"), plot, S, null, monthOf, (v) => (v == null ? "—" : sp(v)));
  const l = (k) => sp(lastOf(R, k).v);
  setHTML("pv-real", l("fd_fresh"));
  setHTML("ex-real-cpi", p2(lastOf(R, "cpi").v)); setHTML("ex-real-fdf", l("fd_fresh")); setHTML("ex-real-fdo", l("fd_outstanding")); setHTML("ex-real-repo", l("repo"));
  const keys = Object.keys(R.series);
  wirePlate("cb-real", plot, "india-atlas_real-interest-rates", csvOf(["month", ...keys.map((k) => R.series[k].name)], R.dates.map((d, i) => [d, ...keys.map((k) => R.series[k].data[i])])));
}

/* =================== § 08 the yield curve, 1 to 30 years =================== */
{
  const Cv = BK.curve, n = Cv.dates.length - 1;
  const lastI = (i) => { while (i >= 0 && Cv.series.y10[i] == null) i--; return i; };
  const picks = [[lastI(n), ACC, true], [lastI(n - 12), G1, false], [lastI(n - 60), G3, false]].filter(([i]) => i >= 0);
  const curveOf = (i) => [...Array(30)].map((_, k) => ({ t: k + 1, v: Cv.series[`y${k + 1}`][i] })).filter((p) => p.v != null);
  const lab = (i) => monthOf(dt(Cv.dates[i]));
  const cSpan = span(picks.flatMap(([i]) => curveOf(i).map((p) => p.v)), 1, false);
  document.getElementById("legend-curve").innerHTML = picks.map(([i, c]) => `<span class="chip"><i style="background:${c}"></i>${lab(i)}</span>`).join("");
  const plot = Plot.plot({
    width: W, height: 440, marginLeft: 44, marginRight: 120, marginTop: 28, marginBottom: 40, style,
    x: { label: "years to maturity", labelAnchor: "right", labelArrow: false, domain: [1, 30], ticks: [1, 5, 10, 15, 20, 25, 30], tickSize: 0, tickPadding: 8, tickFormat: (v) => String(v) },
    y: { label: "yield, per cent a year", labelAnchor: "top", labelArrow: false, ...cSpan, tickSize: 0, tickPadding: 8, tickFormat: (v) => String(v) },
    marks: [
      Plot.gridY(cSpan.ticks.slice(1), { stroke: GRID }),
      ...picks.slice().reverse().map(([i, c, b]) => Plot.lineY(curveOf(i), { x: "t", y: "v", stroke: c, strokeWidth: b ? 2.25 : 1.5, strokeLinejoin: "round" })),
      ...(() => { const ends = picks.map(([i, c, b]) => ({ label: lab(i), y: curveOf(i).at(-1).v, t: curveOf(i).at(-1).t, b })).sort((a, b) => b.y - a.y);
        for (let k = 1; k < ends.length; k++) if (ends[k - 1].y - ends[k].y < 0.28) ends[k].y = ends[k - 1].y - 0.28;
        return ends.map((e) => Plot.text([e], { x: "t", y: "y", text: (d) => d.label, dx: 10, textAnchor: "start", fill: INK, fontSize: 12, fontWeight: e.b ? 600 : 400 })); })(),
    ],
  });
  const c0 = picks[0][0];
  a11y(plot, "The government bond yield curve", `${lab(c0)}: 1-year ${p2(Cv.series.y1[c0])}, 10-year ${p2(Cv.series.y10[c0])}, 30-year ${p2(Cv.series.y30[c0])}.`);
  put("plot-curve", plot);
  setHTML("pv-curve", p2(Cv.series.y10[c0]));
  setHTML("ex-curve-1", p2(Cv.series.y1[c0])); setHTML("ex-curve-10", p2(Cv.series.y10[c0])); setHTML("ex-curve-30", p2(Cv.series.y30[c0]));
  setHTML("ex-curve-spread", fmt.pt2(Cv.spread[c0]).replace(" pt", " percentage points"));
  wirePlate("cb-curve", plot, "india-atlas_yield-curve", csvOf(["years_to_maturity", ...picks.map(([i]) => Cv.dates[i])], [...Array(30)].map((_, k) => [k + 1, ...picks.map(([i]) => Cv.series[`y${k + 1}`][i])])));
}

/* =================== § 08 short and long rates =================== */
{
  const T = BK.t91, Cv = BK.curve;
  const tb = { label: "91-day bill", color: ACC, bold: true, data: T.dates.map((d, i) => ({ date: dt(d), value: T.series.cutoff_yield[i] })) };
  const ten = { label: "10-year bond", color: GOLD, data: Cv.dates.map((d, i) => ({ date: dt(d), value: Cv.series.y10[i] })) };
  const plot = Plot.plot({
    width: W, height: 450, marginLeft: 44, marginRight: 160, marginTop: 28, marginBottom: 34, style,
    x: { type: "utc", label: null, tickSize: 0, tickPadding: 10, ticks: yearTicks(1995, 2025, 5), tickFormat: yearFmt },
    y: { label: "per cent a year", labelAnchor: "top", labelArrow: false, ...span(vals(tb.data, ten.data), 4), tickSize: 0, tickPadding: 8, tickFormat: (v) => String(v) },
    marks: [
      Plot.gridY(span(vals(tb.data, ten.data), 4).ticks.slice(1), { stroke: GRID }),
      Plot.ruleY([0], { stroke: BASE }),
      Plot.lineY(ten.data, { x: "date", y: "value", stroke: GOLD, strokeWidth: 1.75 }),
      Plot.lineY(tb.data, { x: "date", y: "value", stroke: ACC, strokeWidth: 1.25, strokeLinejoin: "round" }),
      ...endLabels([tb, ten], 0.9, p2),
    ],
  });
  const lt = lastOf({ dates: T.dates, series: { y: { data: T.series.cutoff_yield } } }, "y"), l10 = lastOf({ dates: Cv.dates, series: { y: { data: Cv.series.y10 } } }, "y");
  a11y(plot, "The 91-day Treasury bill and the 10-year bond yield since the 1990s", `91-day bill ${p2(lt.v)} on ${dayOf(dt(lt.date))}; 10-year ${p2(l10.v)}.`);
  put("plot-tbill", plot);
  setHTML("pv-tbill", p2(lt.v)); setHTML("ex-tbill-91", p2(lt.v)); setHTML("ex-tbill-10", p2(l10.v));
  wirePlate("cb-tbill", plot, "india-atlas_tbill-91-and-10y", csvOf(["date", "series", "yield_pct"], [...T.dates.map((d, i) => [d, "tbill_91_cutoff", T.series.cutoff_yield[i]]), ...Cv.dates.map((d, i) => [d, "gsec_10y_month_end", Cv.series.y10[i]])]));
}

/* =================== § 08 call money since 1990 =================== */
{
  const Cm = callmB;
  const avg = { label: "Average", color: ACC, bold: true, data: pts(Cm, "average") }, hi = { label: "Highest deal", color: G3, data: pts(Cm, "high") };
  const plot = Plot.plot({
    width: W, height: 440, marginLeft: 44, marginRight: 150, marginTop: 28, marginBottom: 34, style,
    x: { type: "utc", label: null, tickSize: 0, tickPadding: 10, ticks: yearTicks(1990, 2025, 5), tickFormat: yearFmt },
    y: { label: "per cent a year", labelAnchor: "top", labelArrow: false, ...span(vals(hi.data, avg.data), 20), tickSize: 0, tickPadding: 8, tickFormat: (v) => String(v) },
    marks: [
      Plot.gridY(span(vals(hi.data, avg.data), 20).ticks.slice(1), { stroke: GRID }),
      Plot.ruleY([0], { stroke: BASE }),
      Plot.lineY(hi.data, { x: "date", y: "value", stroke: G3, strokeWidth: 1.1 }),
      Plot.lineY(avg.data, { x: "date", y: "value", stroke: ACC, strokeWidth: 1.75, strokeLinejoin: "round" }),
      ...endLabels([avg, hi], 4, p2),
    ],
  });
  const la = lastOf(Cm, "average"), lh = lastOf(Cm, "high");
  a11y(plot, "Call money rate since 1990, monthly", `Average ${p2(la.v)} in ${monthOf(dt(la.date))}, highest deal ${p2(lh.v)}.`);
  put("plot-call", plot);
  addCrosshair(document.getElementById("plot-call"), plot, [avg, hi, { label: "Lowest deal", color: G2, data: pts(Cm, "low") }], null, monthOf);
  setHTML("pv-call", p2(la.v)); setHTML("ex-call-avg", p2(la.v)); setHTML("ex-call-high", p2(lh.v));
  wirePlate("cb-call", plot, "india-atlas_call-money-monthly", csvOf(["month", "average_pct", "high_pct", "low_pct"], Cm.dates.map((d, i) => [d, Cm.series.average.data[i], Cm.series.high.data[i], Cm.series.low.data[i]])));
}

/* =================== § 09 government borrowing =================== */
{
  const Bw = borrowB, lc = (v) => v / 1e5;
  const c = { label: "Centre", color: ACC, bold: true, data: Bw.dates.map((d, i) => ({ date: dt(d), value: lc(Bw.series.centre_gross.data[i]) })) };
  const s = { label: "States", color: GOLD, data: Bw.dates.map((d, i) => ({ date: dt(d), value: lc(Bw.series.states_gross.data[i]) })) };
  const lk = (v) => "₹" + v.toFixed(1) + " lakh cr";
  const plot = Plot.plot({
    width: W, height: 420, marginLeft: 44, marginRight: 170, marginTop: 28, marginBottom: 34, style,
    x: { type: "utc", label: null, tickSize: 0, tickPadding: 10, ticks: yearTicks(1980, 2025, 5), tickFormat: yearFmt },
    y: { label: "₹ lakh crore", labelAnchor: "top", labelArrow: false, ...span(vals(c.data, s.data), 5), tickSize: 0, tickPadding: 8, tickFormat: (v) => String(v) },
    marks: [
      Plot.gridY(span(vals(c.data, s.data), 5).ticks.slice(1), { stroke: GRID }),
      Plot.ruleY([0], { stroke: BASE }),
      Plot.lineY(s.data, { x: "date", y: "value", stroke: GOLD, strokeWidth: 1.75 }),
      Plot.lineY(c.data, { x: "date", y: "value", stroke: ACC, strokeWidth: 2 }),
      ...endLabels([c, s], 1.4, lk),
    ],
  });
  a11y(plot, "Market borrowing of the central and state governments since 1980-81", `Centre ${lk(c.data.at(-1).value)}, states ${lk(s.data.at(-1).value)} in the latest year.`);
  put("plot-borrow", plot);
  addCrosshair(document.getElementById("plot-borrow"), plot, [c, s], null, (d) => `${d.getUTCFullYear()}-${String((d.getUTCFullYear() + 1) % 100).padStart(2, "0")}`, (v) => (v == null ? "—" : lk(v)));
  setHTML("pv-borrow", fmt.lc1(c.data.at(-1).value + s.data.at(-1).value));
  setHTML("ex-bor-c", fmt.lc1(c.data.at(-1).value)); setHTML("ex-bor-s", fmt.lc1(s.data.at(-1).value));
  const keys = Object.keys(Bw.series);
  wirePlate("cb-borrow", plot, "india-atlas_government-market-borrowing", csvOf(["financial_year_start", ...keys.map((k) => Bw.series[k].name)], Bw.dates.map((d, i) => [d, ...keys.map((k) => Bw.series[k].data[i])])));
}
{
  const Dv = devB;
  const rows = Dv.dates.map((d, i) => ({ fy: `${d.slice(0, 4)}-${String((+d.slice(0, 4) + 1) % 100).padStart(2, "0")}`, v: Dv.series.devolved_pd.data[i], n: Dv.series.auctions_devolved.data[i] }));
  const plot = Plot.plot({
    width: W, height: 400, marginLeft: 60, marginRight: 20, marginTop: 28, marginBottom: 40, style,
    x: { type: "band", label: null, tickSize: 0, tickPadding: 8, padding: 0.2, tickFormat: (f) => String(+f.slice(0, 4) % 5 === 0 ? f : "") },
    y: { label: "₹ crore devolved on primary dealers", labelAnchor: "top", labelArrow: false, ...span(rows.map((r) => r.v), 25000), tickSize: 0, tickPadding: 8, tickFormat: (v) => v.toLocaleString("en-IN") },
    marks: [
      Plot.gridY(span(rows.map((r) => r.v), 25000).ticks.slice(1), { stroke: GRID }),
      Plot.barY(rows, { x: "fy", y: "v", fill: ACC, insetLeft: 1, insetRight: 1 }),
      Plot.ruleY([0], { stroke: BASE }),
    ],
  });
  const top = rows.slice().sort((a, b) => b.v - a.v)[0], now = rows.at(-1);
  a11y(plot, "Central government bonds devolved on primary dealers, by financial year", `Largest: ₹${fmt.inr(top.v)} crore in ${top.fy}.`);
  put("plot-devolve", plot);
  setHTML("pv-dev", "₹" + fmt.inr(top.v) + pc(" crore"));
  setHTML("ex-dev-max", "₹" + fmt.inr(top.v) + " crore");
  setHTML("ex-dev-n", String(top.n));
  setHTML("ex-dev-now", now.v > 0 ? `₹${fmt.inr(now.v)} crore on ${now.n} auction days` : "nothing has devolved");
  wirePlate("cb-devolve", plot, "india-atlas_gsec-devolvement", csvOf(["financial_year", "devolved_on_primary_dealers_inr_crore", "auction_days_with_devolvement"], rows.map((r) => [r.fy, r.v, r.n])));
}

/* =================== § 09 what each state pays =================== */
{
  const Sd = sdlB, today = mpcB.meta.meetings.at(-1).date;
  const fyNow = `${+today.slice(0, 4) - (+today.slice(5, 7) >= 4 ? 0 : 1)}-04-01`;
  const i = Sd.dates.filter((d) => d < fyNow).length - 1;
  const rows = Object.entries(Sd.series).filter(([k]) => k.endsWith("_yield") && !k.endsWith("_wavg_yield") && k !== "all_yield")
    .map(([k, s]) => ({ name: s.label.split(":")[0], v: s.data[i] })).filter((r) => r.v != null).sort((a, b) => b.v - a.v);
  const avg = Sd.series.all_yield.data[i];
  const sSpan = span(rows.map((r) => r.v), 0.5, false);
  const plot = Plot.plot({
    width: W, height: 44 + rows.length * 22, marginLeft: 200, marginRight: 80, marginTop: 24, marginBottom: 34, style,
    x: { label: "cut-off yield, per cent a year", labelAnchor: "right", labelArrow: false, ...sSpan, tickSize: 0, tickPadding: 8, tickFormat: (v) => v.toFixed(1) },
    y: { label: null, domain: rows.map((r) => r.name), tickSize: 0, tickPadding: 12 },
    marks: [
      Plot.gridX(sSpan.ticks.slice(1), { stroke: GRID }),
      Plot.ruleX([avg], { stroke: INK, strokeDasharray: "3,3" }),
      Plot.dot(rows, { x: "v", y: "name", r: 4, fill: (d) => (d === rows[0] || d === rows.at(-1) ? ACC : G2) }),
      Plot.text(rows.filter((r) => r.v >= avg), { x: "v", y: "name", text: (d) => p2(d.v), dx: 10, textAnchor: "start", fill: INK, fontSize: 11.5 }),
      Plot.text(rows.filter((r) => r.v < avg), { x: "v", y: "name", text: (d) => p2(d.v), dx: -10, textAnchor: "end", fill: INK, fontSize: 11.5 }),
    ],
  });
  a11y(plot, "Cut-off yield on each state's market loans", rows.map((r) => `${r.name} ${p2(r.v)}`).join(", "));
  put("plot-states", plot);
  setHTML("pv-states", p2(avg));
  setHTML("ex-st-all", p2(avg));
  setHTML("ex-st-lo", `${rows.at(-1).name}, ${p2(rows.at(-1).v)}`);
  setHTML("ex-st-hi", `${rows[0].name}, ${p2(rows[0].v)}`);
  const keys = Object.keys(Sd.series);
  wirePlate("cb-states", plot, "india-atlas_state-borrowing-costs", csvOf(["financial_year_start", ...keys.map((k) => Sd.series[k].name)], Sd.dates.map((d, ii) => [d, ...keys.map((k) => Sd.series[k].data[ii])])));
}

/* =================== § 10 the long view =================== */
{
  const St = structB;
  const cb = St.dates.map((d, i) => ({ date: dt(d), value: St.series.cb_dep_1_3_high.data[i] }));
  const band = St.dates.map((d, i) => ({ date: dt(d), lo: St.series.fmb_dep_1_3_low.data[i], hi: St.series.fmb_dep_1_3_high.data[i] })).filter((p) => p.lo != null && p.hi != null);
  const fmbHi = band.map((p) => ({ date: p.date, value: p.hi }));
  const plot = Plot.plot({
    width: W, height: 420, marginLeft: 44, marginRight: 170, marginTop: 28, marginBottom: 34, style,
    x: { type: "utc", label: null, tickSize: 0, tickPadding: 10, ticks: yearTicks(1970, 2025, 5), tickFormat: yearFmt },
    y: { label: "per cent a year", labelAnchor: "top", labelArrow: false, ...span(vals(cb, fmbHi), 2), tickSize: 0, tickPadding: 8, tickFormat: (v) => String(v) },
    marks: [
      Plot.gridY(span(vals(cb, fmbHi), 2).ticks.slice(1), { stroke: GRID }),
      Plot.ruleY([0], { stroke: BASE }),
      Plot.areaY(band, { x: "date", y1: "lo", y2: "hi", fill: "#DDE3FA" }),
      ...seamMarks("side", [{ data: cb, color: G1, width: 1.75 }, { data: fmbHi, color: ACC, width: 2 }], { text: "Five major banks from 2000-01", y: 1 }),
      ...endLabels([{ label: "Top of range", color: ACC, bold: true, data: fmbHi }], 0.5, p2),
    ],
  });
  const l = band.at(-1);
  let peak = 0; for (const p of cb) if (p.value > peak) peak = p.value;
  a11y(plot, "Deposit rates for one to three years since 1970-71", `Five major banks ${p2(l.lo)} to ${p2(l.hi)} in the latest year; the all-bank rate peaked at ${p2(peak)}.`);
  put("plot-structure", plot);
  setHTML("pv-struct", p2(l.hi));
  setHTML("ex-struct-lo", p2(l.lo)); setHTML("ex-struct-hi", p2(l.hi)); setHTML("ex-struct-peak", p2(peak));
  const keys = Object.keys(St.series);
  wirePlate("cb-structure", plot, "india-atlas_structure-of-interest-rates", csvOf(["financial_year_start", ...keys.map((k) => St.series[k].name)], St.dates.map((d, i) => [d, ...keys.map((k) => St.series[k].data[i])])));
}

/* =================== sortable every-cut tables =================== */
document.querySelectorAll("table.sortable").forEach((t) => {
  t.querySelectorAll("th").forEach((th, col) => th.addEventListener("click", () => {
    const num = th.dataset.sort === "n", dir = th.dataset.dir === "asc" ? -1 : 1; th.dataset.dir = dir === 1 ? "asc" : "desc";
    const key = (tr) => { const v = tr.children[col].textContent.replace(/[%,₹\s]/g, ""); return num ? (v === "" ? -Infinity : +v) : v.toLowerCase(); };
    const rows = [...t.tBodies[0].rows].sort((a, b) => (key(a) > key(b) ? dir : key(a) < key(b) ? -dir : 0));
    t.tBodies[0].append(...rows);
  }));
});

/* =================== provenance =================== */
setHTML("prov-vintage", monthlyB.meta.vintage);
setHTML("prov-vintage2", monthlyB.meta.vintage);
