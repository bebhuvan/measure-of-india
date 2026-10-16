// Trade guide: the plates' data, the page's numbers and the plates themselves, all at build
// time with the chart kit (src/kit/). The bundles are large (HS 4 digits monthly is 1.7 MB), so
// they are read here and cut down; nothing of them reaches the reader's browser except the
// every-cut explorer's chapter and partner tables (explorer(), embedded by trade.astro).
// Values are US$ million unless a plate says otherwise.
import fs from "node:fs";
import * as K from "../kit/kit.js";
import { figure } from "../kit/figure.js";
import * as fmt from "../charts/format.js";
import { CHAPTER } from "./trade-chapters.js";

const B = (s) => JSON.parse(fs.readFileSync(`data/series/${s}.json`, "utf8"));
const has = (s) => fs.existsSync(`data/series/${s}.json`);
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const monthOf = (iso) => `${MONTHS[+iso.slice(5, 7) - 1]} ${iso.slice(0, 4)}`;
const fyOf = (iso) => `${iso.slice(0, 4)}-${String((+iso.slice(0, 4) + 1) % 100).padStart(2, "0")}`;
const r1 = (v) => (v == null ? null : Math.round(v * 10) / 10);

/* ================================================================ the plates' data */
export const T = {};
{
  const tot = B("trade-total");
  T.vintage = tot.meta.vintage;
  T.total = { dates: tot.dates, exports: tot.series.exports.data, imports: tot.series.imports.data, balance: tot.series.balance.data, revision: tot.meta.revision };
}
{
  const a = B("trade-dbie-annual");
  T.long = { dates: a.dates, exports: a.series.exports.data, imports: a.series.imports.data, balance: a.series.balance.data };
  const ai = B("trade-dbie-annual-inr");
  T.ccy = { dates: a.dates, usd: a.series.exports.data, inr: a.dates.map((d) => ai.series.exports.data[ai.dates.indexOf(d)] ?? null), usdImp: a.series.imports.data, inrImp: a.dates.map((d) => ai.series.imports.data[ai.dates.indexOf(d)] ?? null) };
  const m = B("trade-dbie-monthly");
  const i0 = m.dates.indexOf("1997-04-01");
  T.oilm = { dates: m.dates.slice(i0), balance: m.series.balance.data.slice(i0), oil: m.series.balance_oil.data.slice(i0), nonoil: m.series.balance_non_oil.data.slice(i0), lastRev: m.meta.revision[m.dates.at(-1)] };
}
// oil and gold in the deficit: one publication (FTPA principal commodities), financial years
{
  const X = B("trade-principal-exports-fy"), M = B("trade-principal-imports-fy");
  const at = (b, k, d) => b.series[k]?.data[b.dates.indexOf(d)] ?? null;
  T.oilgold = X.dates.map((d) => {
    const bal = at(X, "total", d) - at(M, "total", d);
    const pet = at(X, "g20", d) - at(M, "g20", d);
    const gold = at(X, "ig6", d) - at(M, "ig6", d);
    return { d, fy: fyOf(d), bal: r1(bal), pet: r1(pet), gold: r1(gold), rest: r1(bal - pet - gold), flag: X.meta.revision[d] };
  });
  // the groups, first and latest full year
  const first = X.dates[0], last = X.dates.at(-1);
  const grp = (b) => Object.entries(b.series).filter(([k]) => /^g\d\d$/.test(k)).map(([k, s]) => ({ key: k, label: s.label.replace(/\s*\(group \d+\)$/, ""), first: at(b, k, first), last: at(b, k, last) }));
  T.groups = { firstFy: fyOf(first), lastFy: fyOf(last), exports: grp(X), imports: grp(M), totalX: [at(X, "total", first), at(X, "total", last)], totalM: [at(M, "total", first), at(M, "total", last)] };
  // the latest quick estimate (one month ahead of the final tables)
  const qx = B("trade-principal-exports"), qm = B("trade-principal-imports");
  T.qe = { date: qx.dates.at(-1), exports: qx.series.total.data.at(-1), imports: qm.series.total.data.at(-1), flag: qx.meta.revision[qx.dates.at(-1)],
    exportsYearAgo: qx.series.total.data.at(-13), importsYearAgo: qm.series.total.data.at(-13) };
}
// chapters, latest full financial year
{
  const top = (slug) => { const b = B(slug), n = b.dates.length - 1; return { fy: fyOf(b.dates[n]), prevFy: fyOf(b.dates[n - 1]), rows: Object.entries(b.series).filter(([k]) => k !== "total").map(([k, s]) => ({ code: k.slice(1), label: s.label, last: s.data[n], prev: s.data[n - 1] })).filter((r) => r.last != null).sort((a, c) => c.last - a.last), total: b.series.total.data[n] }; };
  T.chapters = { exports: top("trade-hs2-exports-fy"), imports: top("trade-hs2-imports-fy") };
}
// named goods (HS 4 digits, monthly, US$ million): runs through both HS editions
{
  const X = B("trade-hs4-exports"), M = B("trade-hs4-imports");
  const NAMED = [
    ["exports", "8517", "Phones and telecom equipment"], ["exports", "2710", "Petroleum products (diesel, petrol, jet fuel)"], ["exports", "3004", "Medicines in doses"], ["exports", "1006", "Rice"],
    ["imports", "2709", "Crude oil"], ["imports", "7108", "Gold"], ["imports", "1511", "Palm oil"], ["imports", "2701", "Coal"],
  ];
  { const i = X.dates.length - 1; const vals = Object.entries(X.series).filter(([k]) => k !== "total").map(([k, s]) => [k, s.data[i]]).filter(([, v]) => v != null).sort((a, b) => b[1] - a[1]);
    T.homeRank = { phone: vals.findIndex(([k]) => k === "c8517") + 1, of: vals.length, top: vals[0][0].slice(1) }; }
  T.home = NAMED.map(([f, c, name]) => { const b = f === "exports" ? X : M; return { flow: f, code: c, name, label: b.series["c" + c]?.label ?? c, dates: b.dates, values: b.series["c" + c]?.data ?? [] }; });
}
// quantities, the last full financial year (sum of twelve published months; derived)
{
  const Q = { exports: B("trade-principal-quantity-exports"), imports: B("trade-principal-quantity-imports") };
  const fyEnd = T.chapters.exports.fy; const y0 = +fyEnd.slice(0, 4);
  const months = Array.from({ length: 12 }, (_, k) => `${k < 9 ? y0 : y0 + 1}-${String(((k + 3) % 12) + 1).padStart(2, "0")}-01`);
  const fySum = (f, key) => { const b = Q[f], s = b.series[key]; if (!s) return null; const v = months.map((d) => s.data[b.dates.indexOf(d)]); return v.some((x) => x == null) ? null : v.reduce((a, x) => a + x, 0); };
  T.qty = { fy: fyEnd,
    gold: fySum("imports", "ig6_kgs"), vegoil: fySum("imports", "ib8_ton"), crude: fySum("imports", "is5_ton"), coal: fySum("imports", "if1_ton"),
    riceB: fySum("exports", "ia3_ton"), riceNB: fySum("exports", "ia4_ton"), products: fySum("exports", "is6_ton") };
  const o = B("trade-dbie-oil-volumes");
  T.crude = { dates: o.dates, imports: o.series.crude_imports.data, production: o.series.crude_production.data };
}
// partners
{
  const F = B("trade-partners-balance-fy"), n = F.dates.length - 1;
  const X = B("trade-partners-exports-fy"), M = B("trade-partners-imports-fy");
  const rows = Object.entries(F.series).map(([k, s]) => ({ key: k, name: s.label.replace(/: exports minus imports \(derived\)$/, ""), bal: s.data[n], exp: X.series[k]?.data[n] ?? null, imp: M.series[k]?.data[n] ?? null })).filter((r) => r.bal != null && !/unspecified/i.test(r.name));
  rows.sort((a, c) => a.bal - c.bal);
  T.partners = { fy: fyOf(F.dates[n]), deficits: rows.slice(0, 10), surpluses: rows.slice(-10).reverse(), n: rows.length, inDeficit: rows.filter((r) => r.bal < 0).length };
  const Lg = B("trade-partners-long"), pick = (k) => ({ exp: Lg.series[`${k}__exports`]?.data, imp: Lg.series[`${k}__imports`]?.data, bal: Lg.series[`${k}__balance`]?.data });
  T.chinaus = { dates: Lg.dates, china: pick("china"), usa: pick("united_states"), flag: Lg.meta.revision };
  const RX = B("trade-regions-exports-fy"), RM = B("trade-regions-imports-fy"), rn = RX.dates.length - 1;
  T.regions = Object.entries(RX.series).filter(([k]) => /^region_/.test(k)).map(([k, s]) => ({ name: s.label.replace(/, all countries$/, ""), exp: s.data[rn], imp: RM.series[k]?.data[rn] ?? null }));
}
// commodity x partner: what goes to the United States, what comes from China
if (has("trade-partner-hs2-exports") && has("trade-partner-hs2-imports")) {
  const top = (slug, ck) => { const b = B(slug), n = b.dates.length - 1; return { fy: fyOf(b.dates[n]), rows: Object.entries(b.series).filter(([k]) => k.startsWith(ck + "__")).map(([k, s]) => ({ code: k.split("__c")[1], label: s.label.replace(/^[^:]+:\s*/, ""), last: s.data[n] })).filter((r) => r.last != null).sort((a, c) => c.last - a.last).slice(0, 10) }; };
  T.cxc = { us: top("trade-partner-hs2-exports", "united_states"), china: top("trade-partner-hs2-imports", "china") };
}
// prices and volumes (DGCI&S indices, base 2012-13)
{
  const t = B("trade-dbie-tot-2012");
  T.tot = { dates: t.dates, uviX: t.series.uvi_exports.data, uviM: t.series.uvi_imports.data, qiX: t.series.qi_exports.data, qiM: t.series.qi_imports.data, net: t.series.tot_net.data, withheld: t.series.qi_exports.withheldNote ?? null };
}
{
  const YTD = { x: B("trade-hs2-exports-ytd"), m: B("trade-hs2-imports-ytd") };
  T.ytd = { label: YTD.x.meta.period.label, prev: [YTD.x.series.total.data[0], YTD.m.series.total.data[0]], cur: [YTD.x.series.total.data[1], YTD.m.series.total.data[1]], fy: fyOf(YTD.x.dates[1]) };
}

/** The every-cut explorer's inline tables (chapters and partners); finer ones load on request. */
export function explorer() {
  // the table compares the latest two years, so only those two travel to the page
  const ex = (slug) => { const b = B(slug); return { dates: b.dates.slice(-2), rows: Object.entries(b.series).map(([k, s]) => [k, s.label, s.data.slice(-2)]) }; };
  return { hs2x: ex("trade-hs2-exports-fy"), hs2m: ex("trade-hs2-imports-fy"), px: ex("trade-partners-exports-fy"), pm: ex("trade-partners-imports-fy") };
}
/** The explorer's opening state (chapters, exports), so its header and count are in the HTML. */
export function explorerStart() {
  const E = explorer().hs2x, n = E.dates.length - 1;
  const rows = E.rows.filter(([k]) => k !== "total");
  return { cur: fyOf(E.dates[n]), prev: n > 0 ? fyOf(E.dates[n - 1]) : "", n: `${rows.length.toLocaleString("en-IN")} rows` };
}

/* ================================================================ formats */
const bn = (v) => fmt.bnFixed1(v / 1000);                 // US$ million -> "$44.3 bn", "−$31.9 bn"
const mn = (v) => "$" + Math.round(v).toLocaleString("en-IN") + " mn";
const pct = (a, b) => (100 * a) / b;
const growth = (a, b) => (a / b - 1) * 100;
const shortChap = (s, code) => CHAPTER[code] ?? s.replace(/\s*\(HS \d+\)$/, "").replace(/;.*$/, "").slice(0, 46);
const ord = (n) => n + (["th", "st", "nd", "rd"][(n % 100 > 10 && n % 100 < 14) ? 0 : n % 10] ?? "th");
const cap = (x) => x.charAt(0).toUpperCase() + x.slice(1);
const bnAbs = (v) => fmt.bnFixed1(Math.abs(v) / 1000);
const cleanGroup = (s) => s.replace(/Electorinics/i, "Electronics").replace(/Electoronics/i, "Electronics").replace(/^Articles of stone.*$/i, "Stone, ceramics and glass").replace(/\s+items$/i, "");
const words = (a) => (a.length <= 1 ? a.join("") : a.slice(0, -1).join(", ") + " and " + a.at(-1));
const the = (nm) => (/^(United|Netherlands|Philippines)/.test(nm) ? "the " + nm : nm);
// US$ million -> US$ billion at the one decimal every label and the prose show
const toBn = (v) => (v == null ? null : Math.round(v / 100) / 10);
const pairsBn = (dates, vals) => dates.map((d, i) => [d, toBn(vals[i])]);
const BN = { prefix: "$", suffix: " bn" };
const HL = { exports: "g14", imports: "g20" };   // the group each groups plate picks out

/* ================================================================ the page's numbers */
// W[id] is the HTML each number id on the page shows (formerly set by trade.client.js).
export const W = {};
{
  const t = T.total, n = t.dates.length - 1;
  const ex = t.exports[n], im = t.imports[n], bal = t.balance[n];
  const exY = t.exports[n - 12], imY = t.imports[n - 12], balY = t.balance[n - 12];
  const latestMonth = monthOf(t.dates[n]), yearAgoMonth = monthOf(t.dates[n - 12]);
  Object.assign(W, {
    "n-exp": bn(ex), "d-exp": `<b>${fmt.pct1Minus(growth(ex, exY))}</b> on ${yearAgoMonth}`,
    "n-imp": bn(im), "d-imp": `<b>${fmt.pct1Minus(growth(im, imY))}</b> on ${yearAgoMonth}`,
    "n-bal": bn(bal), "d-bal": `<b>${bn(balY)}</b> in ${yearAgoMonth}`,
    "n-ytd": bn(T.ytd.cur[0]), "d-ytd": `<b>${fmt.pct1Minus(growth(T.ytd.cur[0], T.ytd.prev[0]))}</b> on the same months a year earlier`,
    "rb-big": bn(bal), "rb-exp": bn(ex),
  });
  if (T.qe) Object.assign(W, { "qe-month": monthOf(T.qe.date), "qe-exp": bn(T.qe.exports), "qe-imp": bn(T.qe.imports) });

  // § 02 eight goods
  const byCode = Object.fromEntries(T.home.map((g) => [g.code, g]));
  const phone = byCode["8517"], p17 = phone.values[phone.dates.indexOf("2017-01-01")], r = T.homeRank;
  W["pv-home"] = mn(phone.values.at(-1));
  W["h-home"] = `Phone and telecom exports rose from ${mn(p17)} in January 2017 to ${mn(phone.values.at(-1))} in ${latestMonth}, ${r.phone === 1 ? "the largest" : "the " + (["", "", "second", "third", "fourth", "fifth"][r.phone] ?? ord(r.phone)) + "-largest"} of India's ${r.of.toLocaleString("en-IN")} export headings that month${r.phone === 1 ? "" : byCode[r.top] ? ` (behind ${byCode[r.top].name.toLowerCase().replace(/ \(.*\)$/, "")})` : ` (behind HS heading ${r.top})`}`;
  W["ex-h-phone"] = mn(phone.values.at(-1));
  W["ex-h-phone17"] = mn(p17);
  W["ex-h-crude"] = mn(byCode["2709"].values.at(-1));
  W["ex-h-gold"] = mn(byCode["7108"].values.at(-1));
  const q = T.qty, mt = (v) => (v / 1e6).toFixed(1) + " million tonnes";
  W["lv-oil"] = mt(q.vegoil);
  W["lv-gold"] = Math.round(q.gold / 1000).toLocaleString("en-IN") + " tonnes";
  W["lv-crude"] = mt(q.crude);
  W["lv-rice"] = mt(q.riceB + q.riceNB);

  // § 04 the long view
  const L = T.long, i = L.dates.length - 1;
  W["pv-long"] = bn(L.balance[i]);
  W["ex-l-exp"] = bn(L.exports[i]); W["ex-l-imp"] = bn(L.imports[i]); W["ex-l-bal"] = bn(L.balance[i]);
  W["ex-l-x"] = fmt.num1(L.exports[i] / L.exports[L.dates.indexOf("1990-04-01")]);
  const surplus = L.dates.filter((d, k) => L.balance[k] > 0).map(fyOf);
  W["ex-l-surp"] = surplus.length ? `${surplus.length === 1 ? "one year" : surplus.length + " years"}, ${words(surplus)}` : "none of these years";
  const narrow = L.dates.map((d, k) => (k ? { fy: fyOf(d), dv: L.balance[k] - L.balance[k - 1], im: L.imports[k] - L.imports[k - 1] } : null)).filter((x) => x && x.dv > 0 && x.im < 0).sort((a, b) => b.dv - a.dv).slice(0, 2);
  W["ex-l-narrow"] = words(narrow.map((x) => x.fy));
  W["h-long"] = `India has bought more than it sold in ${L.dates.length - surplus.length} of the ${L.dates.length} years since 1970-71, and the gap has widened as trade grew`;

  // months since 2017
  W["pv-month"] = bn(bal); W["ex-m-bal"] = bn(bal); W["ex-m-bal1"] = bn(balY);
  let kmin = 0; t.balance.forEach((v, k) => { if (v < t.balance[kmin]) kmin = k; });
  W["ex-m-max"] = bn(t.balance[kmin]); W["ex-m-maxd"] = monthOf(t.dates[kmin]);
  const fyMonths = {};
  t.dates.forEach((d, k) => { const y = +d.slice(0, 4), m = +d.slice(5, 7), f = m >= 4 ? y : y - 1; (fyMonths[f] ??= []).push([m, t.exports[k]]); });
  const full = Object.values(fyMonths).filter((a) => a.length === 12);
  W["ex-m-march"] = `${full.filter((a) => a.reduce((p, c) => (c[1] > p[1] ? c : p))[0] === 3).length} of ${full.length}`;
  const avg = (a) => a.reduce((x, y) => x + y, 0) / a.length, first12 = avg(t.balance.slice(0, 12)), last12 = avg(t.balance.slice(-12));
  W["h-month"] = first12 < 0 && last12 < 0
    ? `The monthly trade deficit averaged ${bnAbs(last12)} over the last twelve months, against ${bnAbs(first12)} a month in 2017`
    : `India's monthly trade balance averaged ${bn(last12)} over the last twelve months, against ${bn(first12)} in 2017`;

  // § 05 oil and gold
  const G = T.oilgold.at(-1), shares = T.oilgold.map((x) => pct(x.pet + x.gold, x.bal));
  W["pv-oilgold"] = fmt.pct1(pct(G.pet + G.gold, G.bal));
  W["h-oilgold"] = Math.min(...shares) > 50
    ? `Oil and gold made up more than half of India's trade deficit in every year since ${T.oilgold[0].fy}; the rest has grown from ${bnAbs(T.oilgold[0].rest)} to ${bnAbs(G.rest)}`
    : `Oil and gold made up ${fmt.pct1(shares.at(-1))} of India's trade deficit in ${G.fy}`;
  W["ex-og-bal"] = bn(G.bal); W["ex-og-pet"] = bn(G.pet); W["ex-og-gold"] = bn(G.gold); W["ex-og-rest"] = bn(G.rest);
  const O = T.oilm, ko = O.dates.length - 1;
  W["pv-oilm"] = bn(O.oil[ko]); W["ex-om-oil"] = bn(O.oil[ko]); W["ex-om-non"] = bn(O.nonoil[ko]);
  W["ex-om-rev"] = O.lastRev === "Provisional" ? "provisional" : "final";

  // § 06 groups and chapters
  for (const [flow, id] of [["exports", "sell"], ["imports", "buy"]]) {
    const Gs = groupRows(flow), pick = Gs.find((g) => g.key === HL[flow]);
    W[`pv-${id}`] = fmt.bnFixed1(pick.b);
    const tag = flow === "exports" ? "s" : "b";
    Gs.slice(0, 3).forEach((g, k) => { W[`ex-${tag}-${k + 1}`] = `${g.name.toLowerCase()} (${fmt.bnFixed1(g.b)})`; });
    if (flow === "exports") {
      W["ex-s-el0"] = fmt.bnFixed1(pick.a); W["ex-s-el1"] = fmt.bnFixed1(pick.b);
      W["h-sell"] = `Electronics exports grew ${fmt.num1(pick.b / pick.a)} times between ${T.groups.firstFy} and ${T.groups.lastFy}, to ${ord(Gs.indexOf(pick) + 1)} place among India's ${Gs.length} export groups`;
    } else {
      W["h-buy"] = `${cap(Gs[0].name.toLowerCase())}, ${Gs[1].name.toLowerCase()} and ${Gs[2].name.toLowerCase()} are what India buys most: ${fmt.pct1(pct(Gs[0].b + Gs[1].b + Gs[2].b, T.groups.totalM[1] / 1000))} of its imports in ${T.groups.lastFy}`;
    }
  }
  for (const [flow, id] of [["exports", "chapx"], ["imports", "chapm"]]) {
    const C = T.chapters[flow], share = pct(C.rows.slice(0, 12).reduce((s, x) => s + x.last, 0), C.total), tag = flow === "exports" ? "x" : "m";
    W[`pv-${id}`] = fmt.pct1(share);
    W[`ex-c-${tag}1`] = shortChap(C.rows[0].label, C.rows[0].code).toLowerCase() + ` (HS ${C.rows[0].code})`;
    W[`ex-c-${tag}1v`] = bn(C.rows[0].last);
    W[`ex-c-${tag}2`] = shortChap(C.rows[1].label, C.rows[1].code).toLowerCase() + ` (HS ${C.rows[1].code})`;
    W[`ex-c-${tag}2v`] = bn(C.rows[1].last);
    W[`h-${id}`] = `${shortChap(C.rows[0].label, C.rows[0].code)} led India's ${flow} in ${C.fy}, ahead of ${shortChap(C.rows[1].label, C.rows[1].code).toLowerCase()}; the top twelve chapters made up ${fmt.pct1(share)} of the total`;
  }

  // § 07 partners
  const P = T.partners, cn = P.deficits.find((x) => x.key === "china"), us = P.surpluses.find((x) => x.key === "united_states");
  W["h-partners"] = `India's largest trade deficit is with ${the(P.deficits[0].name)} (${bn(P.deficits[0].bal)}); its largest surplus is with ${the(P.surpluses[0].name)} (${bn(P.surpluses[0].bal)})`;
  W["pv-partners"] = bn(cn?.bal); W["ex-p-n"] = String(P.inDeficit); W["ex-p-of"] = String(P.n);
  W["ex-p-cn"] = bn(cn?.bal); W["ex-p-us"] = bn(us?.bal);
  const CU = T.chinaus, kc = CU.dates.length - 1;
  W["pv-chinaus"] = bn(CU.china.imp[kc]);
  W["h-chinaus"] = `The deficit with China grew from ${bnAbs(CU.china.bal[0])} in ${fyOf(CU.dates[0])} to ${bnAbs(CU.china.bal[kc])} in ${fyOf(CU.dates[kc])}; the surplus with the United States from ${bnAbs(CU.usa.bal[0])} to ${bnAbs(CU.usa.bal[kc])}`;
  W["ex-cu-cnm"] = bn(CU.china.imp[kc]); W["ex-cu-cnx"] = bn(CU.china.exp[kc]); W["ex-cu-usx"] = bn(CU.usa.exp[kc]); W["ex-cu-usm"] = bn(CU.usa.imp[kc]);
  if (T.cxc) {
    const elec = T.cxc.china.rows.find((x) => x.code === "85");
    W["pv-cxc"] = bn(elec?.last ?? 0); W["sub-cxc"] = T.cxc.us.fy;
    W["ex-x-us1"] = shortChap(T.cxc.us.rows[0].label, T.cxc.us.rows[0].code).toLowerCase(); W["ex-x-us1v"] = bn(T.cxc.us.rows[0].last);
    W["ex-x-cn1"] = shortChap(T.cxc.china.rows[0].label, T.cxc.china.rows[0].code).toLowerCase(); W["ex-x-cn1v"] = bn(T.cxc.china.rows[0].last);
  }
  const asia = T.regions.find((x) => /^Asia$/i.test(x.name));
  const tx = T.regions.reduce((s, x) => s + (x.exp ?? 0), 0), tm = T.regions.reduce((s, x) => s + (x.imp ?? 0), 0);
  W["pv-regions"] = fmt.pct1(pct(asia.imp, tm));
  const bigX = T.regions.reduce((a, x) => ((x.exp ?? 0) > (a.exp ?? 0) ? x : a)), bigM = T.regions.reduce((a, x) => ((x.imp ?? 0) > (a.imp ?? 0) ? x : a));
  W["h-regions"] = bigX === asia && bigM === asia ? `Asia is India's biggest market and its biggest supplier: ${fmt.pct1(pct(asia.exp, tx))} of exports go there and ${fmt.pct1(pct(asia.imp, tm))} of imports come from there` : `${bigX.name} buys most of India's exports; ${bigM.name} supplies most of its imports`;
  W["ex-r-ax"] = fmt.pct1(pct(asia.exp, tx)); W["ex-r-am"] = fmt.pct1(pct(asia.imp, tm));

  // § 08 prices and volumes, tonnes, the rupee
  const PT = T.tot, kt = PT.dates.length - 1;
  W["pv-tot"] = fmt.num1(PT.net[kt]);
  const g0 = (a) => { const j = a.findIndex((v) => v != null); return { j, v: a[j] }; };
  const lastOf = (a) => { for (let j = a.length - 1; j >= 0; j--) if (a[j] != null) return { j, v: a[j] }; return null; };
  const mP = g0(PT.uviM), mPl = lastOf(PT.uviM), mV = g0(PT.qiM), mVl = lastOf(PT.qiM);
  W["h-tot"] = `Between ${fyOf(PT.dates[mP.j])} and ${fyOf(PT.dates[mPl.j])}, the volume of India's imports rose ${fmt.pct0(growth(mVl.v, mV.v))} and their average price ${fmt.pct0(growth(mPl.v, mP.v))}`;
  W["ex-t-ux"] = fmt.num1(PT.uviX[kt]); W["ex-t-um"] = fmt.num1(PT.uviM[kt]);
  W["ex-t-withheld"] = PT.withheld ? "The export volume index for the latest year is not shown: the RBI's table prints a figure that cannot be reconciled with the value of exports." : "No point is withheld.";
  const CR = T.crude, kr = CR.dates.length - 1;
  W["pv-crude"] = fmt.pct1(pct(CR.imports[kr], CR.imports[kr] + CR.production[kr]));
  const j0 = CR.dates.findIndex((d, j) => CR.imports[j] != null && CR.production[j] != null);
  W["h-crude"] = `India bought ${fmt.pct0(pct(CR.imports[kr], CR.imports[kr] + CR.production[kr]))} of its crude oil abroad in ${fyOf(CR.dates[kr])}, against ${fmt.pct0(pct(CR.imports[j0], CR.imports[j0] + CR.production[j0]))} in ${fyOf(CR.dates[j0])}`;
  W["ex-cr-imp"] = fmt.num1(CR.imports[kr]) + " million tonnes"; W["ex-cr-prod"] = fmt.num1(CR.production[kr]) + " million tonnes";
  const R = ccyRows(), Lc = R.at(-1), withInr = R.filter((x) => x.inr != null), beat = withInr.filter((x) => x.inr > x.usd).length;
  W["pv-ccy"] = `${beat} of ${withInr.length}`;
  W["h-ccy"] = `Measured in rupees, exports grew faster than in dollars in ${beat} of the ${withInr.length} years since ${fyOf(R[0].d)}: the rupee weakened against the dollar in most of them`;
  W["ex-cc-usd"] = fmt.pct1Minus(Lc.usd); W["ex-cc-inr"] = fmt.pct1Minus(Lc.inr);

  W["prov-vintage"] = T.vintage ?? ""; W["prov-vintage2"] = T.vintage ?? "";
}
function groupRows(flow) {
  return T.groups[flow].map((g) => ({ name: cleanGroup(g.label), a: g.first / 1000, b: g.last / 1000, key: g.key, first: g.first, last: g.last })).sort((x, y) => y.b - x.b);
}
function ccyRows() {
  const C = T.ccy, i0 = C.dates.indexOf("1991-04-01");
  return C.dates.map((d, j) => (j < i0 || j === 0 ? null : { d, usd: growth(C.usd[j], C.usd[j - 1]), inr: C.inr[j] != null && C.inr[j - 1] != null ? growth(C.inr[j], C.inr[j - 1]) : null })).filter(Boolean);
}

/* ================================================================ the plates */
/** Title block: five years of monthly exports, a spark under the number. */
export const sparkExports = () => K.spark(pairsBn(T.total.dates.slice(-60), T.total.exports.slice(-60)), { width: 190, height: 44 });

/** § 02: eight goods, each on its own scale; phones (the plate's finding) in the lead colour. */
export function home() {
  const lastOf = (a) => a.filter((v) => v != null).at(-1);
  const panels = T.home.map((g) => ({ name: g.name, sub: `HS ${g.code}, ${g.flow}`, vText: mn(lastOf(g.values)), highlight: g.code === "8517", data: g.dates.map((d, i) => [d, g.values[i] ?? null]) }));
  return figure({
    bare: true, file: "india-atlas_trade-eight-goods",
    label: "Eight goods by HS heading, monthly trade value in US$ million since January 2017, each panel on its own scale: phones, petroleum products, medicines and rice exported; crude oil, gold, palm oil and coal imported",
    data: { cols: ["Month", ...T.home.map((g) => `${g.flow} HS ${g.code} ${g.name} (US$ mn)`)], rows: T.home[0].dates.map((d, i) => [d, ...T.home.map((g) => g.values[g.dates.indexOf(d)] ?? null)]) },
    draw: (width) => K.multiples({ width, panels, shared: false, unit: {}, vFmt: mn }),
  });
}

/** § 04: exports and imports since 1970-71; the gap between them is the deficit. */
export function long() {
  const L = T.long;
  return figure({
    bare: true, file: "india-atlas_trade-since-1970",
    label: `India's merchandise exports and imports, US$ billion, financial years 1970-71 to ${fyOf(L.dates.at(-1))}`,
    data: { cols: ["financial_year", "exports_usd_mn", "imports_usd_mn", "balance_usd_mn"], rows: L.dates.map((d, k) => [fyOf(d), L.exports[k], L.imports[k], L.balance[k]]) },
    draw: (width) => K.line({
      width, freq: "fy", unit: BN, endDp: 1,
      series: [
        { name: "Imports", data: pairsBn(L.dates, L.imports), role: "comp" },
        { name: "Exports", data: pairsBn(L.dates, L.exports), role: "lead" },
      ],
    }),
  });
}

/** § 04: the months since 2017, exports, imports and the balance between them. */
export function month() {
  const t = T.total;
  return figure({
    bare: true, file: "india-atlas_trade-monthly",
    label: "India's monthly merchandise exports, imports and trade balance, US$ billion, since January 2017",
    data: { cols: ["month", "exports_usd_mn", "imports_usd_mn", "balance_usd_mn", "print"], rows: t.dates.map((d, k) => [d, t.exports[k], t.imports[k], t.balance[k], t.revision?.[d] ?? ""]) },
    draw: (width) => K.line({
      width, freq: "month", unit: BN, endDp: 1,
      series: [
        { name: "Balance", data: pairsBn(t.dates, t.balance), role: "ctx" },
        { name: "Imports", data: pairsBn(t.dates, t.imports), role: "comp" },
        { name: "Exports", data: pairsBn(t.dates, t.exports), role: "lead" },
      ],
      events: [{ t: "2020-04-01", label: "National lockdown", short: "Lockdown" }],
    }),
  });
}

/** § 05: each year's deficit as one bar, cut into petroleum, gold and everything else. */
export function oilgold() {
  const R = T.oilgold;
  // the parts are deficits (balances below zero), drawn as their size; a part in surplus would
  // not stack, so it is shown as zero and said so in the row's note
  const size = (v) => (v == null ? null : Math.max(0, -toBn(v)));
  // (everything else takes the remainder after rounding, so each bar ends at the deficit the page quotes)
  return figure({
    bare: true, file: "india-atlas_trade-deficit-oil-gold",
    label: `India's merchandise trade deficit by financial year, ${R[0].fy} to ${R.at(-1).fy}, each bar cut into petroleum, gold and everything else, US$ billion`,
    data: { cols: ["financial_year", "balance_usd_mn", "petroleum_balance_usd_mn", "gold_balance_usd_mn", "everything_else_usd_mn", "print"], rows: R.map((r) => [r.fy, r.bal, r.pet, r.gold, r.rest, r.flag]) },
    draw: (width) => K.stackBars({
      width, sort: false, absolute: { unit: { prefix: "$", suffix: " bn" }, dp: 1 },
      parts: [{ name: "Petroleum", color: K.C.lead }, { name: "Gold", color: K.C.turmeric }, { name: "Everything else", color: K.C.ctx2 }],
      rows: R.map((r) => ({ name: r.fy, parts: [size(r.pet), size(r.gold), r1(size(r.bal) - size(r.pet) - size(r.gold))], highlight: r === R.at(-1),
        note: [r.pet, r.gold, r.rest].some((v) => v > 0) ? "one part in surplus" : undefined })),
    }),
  });
}

/** § 05: the monthly balance in oil and in everything else since 1997. */
export function oilm() {
  const O = T.oilm;
  return figure({
    bare: true, file: "india-atlas_trade-oil-non-oil-balance",
    label: `India's monthly trade balance in oil and in everything else, US$ billion, April 1997 to ${monthOf(O.dates.at(-1))}`,
    data: { cols: ["month", "balance_usd_mn", "oil_balance_usd_mn", "non_oil_balance_usd_mn"], rows: O.dates.map((d, j) => [d, O.balance[j], O.oil[j], O.nonoil[j]]) },
    draw: (width) => K.line({
      width, freq: "month", unit: BN, endDp: 1,
      series: [
        { name: "Non-oil", data: pairsBn(O.dates, O.nonoil), role: "ctx" },
        { name: "Oil", data: pairsBn(O.dates, O.oil), role: "lead" },
      ],
    }),
  });
}

// ranked bars, the latest year as the bar and the earlier one as a hollow circle on it
const bnRows = (rows, prevFy) => (width) => K.bars({ width, rows, unit: { prefix: "$" }, dp: 1, markName: prevFy, nameMax: 330 });

/** § 06: the 21 principal-commodity groups, exports or imports. */
export function groups(flow) {
  const G = groupRows(flow);
  return figure({
    bare: true, file: `india-atlas_trade-${flow}-by-group`,
    label: `India's ${flow} by the Ministry's principal-commodity groups, US$ billion, ${T.groups.lastFy} as bars with ${T.groups.firstFy} as circles`,
    data: { cols: ["group", `${T.groups.firstFy}_usd_mn`, `${T.groups.lastFy}_usd_mn`], rows: G.map((g) => [g.name, g.first, g.last]) },
    draw: bnRows(G.map((g) => ({ name: g.name, value: toBn(g.last), mark: toBn(g.first), highlight: g.key === HL[flow] })), T.groups.firstFy),
  });
}

/** § 06: the twelve largest HS chapters, exports or imports. */
export function chapters(flow) {
  const C = T.chapters[flow];
  return figure({
    bare: true, file: `india-atlas_trade-${flow}-by-chapter`,
    label: `The twelve largest HS chapters of India's ${flow}, US$ billion, ${C.fy} as bars with ${C.prevFy} as circles`,
    data: { cols: ["hs_chapter", "description", `${C.prevFy}_usd_mn`, `${C.fy}_usd_mn`], rows: C.rows.map((r) => [r.code, r.label, r.prev, r.last]) },
    draw: bnRows(C.rows.slice(0, 12).map((r, i) => ({ name: `${shortChap(r.label, r.code)} (${r.code})`, value: toBn(r.last), mark: toBn(r.prev), highlight: i === 0 })), C.prevFy),
  });
}

/** § 07: the ten largest deficits and the ten largest surpluses, China and the US picked out. */
export function partners() {
  const P = T.partners, rows = [...P.deficits, ...P.surpluses];
  return figure({
    bare: true, file: "india-atlas_trade-balance-by-partner",
    label: `India's trade balance with its ten largest deficit and ten largest surplus partners, US$ billion, ${P.fy}`,
    data: { cols: ["partner", "exports_usd_mn", "imports_usd_mn", "balance_usd_mn"], rows: rows.map((r) => [r.name, r.exp, r.imp, r.bal]) },
    draw: (width) => K.bars({ width, rows: rows.map((r) => ({ name: r.name, value: toBn(r.bal), highlight: r.key === "china" || r.key === "united_states" })), unit: { prefix: "$" }, dp: 1 }),
  });
}

/** § 07: the balance with China and with the United States, year by year. */
export function chinaus() {
  const C = T.chinaus;
  return figure({
    bare: true, file: "india-atlas_trade-china-united-states",
    label: `India's trade balance with China and with the United States, US$ billion, financial years ${fyOf(C.dates[0])} to ${fyOf(C.dates.at(-1))}`,
    data: { cols: ["financial_year", "china_exports", "china_imports", "china_balance", "us_exports", "us_imports", "us_balance"], rows: C.dates.map((d, j) => [fyOf(d), C.china.exp[j], C.china.imp[j], C.china.bal[j], C.usa.exp[j], C.usa.imp[j], C.usa.bal[j]]) },
    draw: (width) => K.line({
      width, freq: "fy", unit: BN, endDp: 1,
      series: [
        { name: "United States", short: "US", data: pairsBn(C.dates, C.usa.bal), role: "comp" },
        { name: "China", data: pairsBn(C.dates, C.china.bal), role: "lead" },
      ],
    }),
  });
}

/** § 07: what goes to the United States and what comes from China, by chapter. */
export function cxc() {
  if (!T.cxc) return "";
  const rows = [...T.cxc.us.rows.map((r) => ({ name: `To the US: ${shortChap(r.label, r.code)} (${r.code})`, value: toBn(r.last), color: K.C.lead })),
    ...T.cxc.china.rows.map((r) => ({ name: `From China: ${shortChap(r.label, r.code)} (${r.code})`, value: toBn(r.last), color: K.C.comp }))];
  return figure({
    bare: true, file: "india-atlas_trade-us-china-by-chapter",
    label: `The ten largest HS chapters in India's exports to the United States and its imports from China, US$ billion, ${T.cxc.us.fy}`,
    data: { cols: ["direction", "hs_chapter", "description", "usd_mn"], rows: [...T.cxc.us.rows.map((r) => ["exports to United States", r.code, r.label, r.last]), ...T.cxc.china.rows.map((r) => ["imports from China", r.code, r.label, r.last])] },
    draw: (width) => K.bars({ width, rows, sort: false, unit: { prefix: "$" }, dp: 1, nameMax: 380 }),
  });
}

/** § 07: exports and imports by region; the gap between the dots is the balance. */
export function regions() {
  const R = T.regions.filter((r) => r.exp != null && r.imp != null);
  return figure({
    bare: true, file: "india-atlas_trade-by-region",
    label: `India's exports and imports by region, US$ billion, ${T.partners.fy}`,
    data: { cols: ["region", "exports_usd_mn", "imports_usd_mn"], rows: T.regions.map((r) => [r.name, r.exp, r.imp]) },
    draw: (width) => K.dumbbell({
      width, rows: R.map((r) => ({ name: r.name.replace(/ Region$/, ""), a: toBn(r.imp), b: toBn(r.exp), highlight: /^Asia$/i.test(r.name) })),
      keys: { a: "Imports", b: "Exports" }, sortBy: "a", labelAll: true, fmt: (v) => K.num(v, { dp: 1, prefix: "$" }),
    }),
  });
}

/** § 08: price and volume indices, one panel each, on one scale (2012-13 = 100). */
export function tot() {
  const P = T.tot, p = (vals) => P.dates.map((d, i) => [d, vals[i] ?? null]);
  const panels = [
    { name: "Import volume", data: p(P.qiM), highlight: true }, { name: "Import prices", data: p(P.uviM), highlight: true },
    { name: "Export volume", data: p(P.qiX) }, { name: "Export prices", data: p(P.uviX) },
  ];
  return figure({
    bare: true, file: "india-atlas_trade-prices-volumes",
    label: `Unit value (price) and quantum (volume) indices of India's exports and imports, 2012-13 = 100, financial years ${fyOf(P.dates[0])} to ${fyOf(P.dates.at(-1))}`,
    data: { cols: ["financial_year", "export_unit_value", "import_unit_value", "export_quantum", "import_quantum", "net_terms_of_trade"], rows: P.dates.map((d, j) => [fyOf(d), P.uviX[j], P.uviM[j], P.qiX[j], P.qiM[j], P.net[j]]) },
    draw: (width) => K.multiples({ width, panels, fy: true, unit: {}, cols: width > 1000 ? 4 : 2, ref: { data: P.dates.map((d) => [d, 100]) } }),
  });
}

/** § 08: crude oil imported against crude produced at home, million tonnes. */
export function crude() {
  const C = T.crude, p = (vals) => C.dates.map((d, i) => [d, vals[i] ?? null]);
  return figure({
    bare: true, file: "india-atlas_crude-oil-production-imports",
    label: `Crude oil imported and produced in India, million tonnes, financial years ${fyOf(C.dates[0])} to ${fyOf(C.dates.at(-1))}`,
    data: { cols: ["financial_year", "crude_imported_mt", "crude_produced_mt"], rows: C.dates.map((d, j) => [fyOf(d), C.imports[j], C.production[j]]) },
    draw: (width) => K.line({
      width, freq: "fy", unit: { suffix: " Mt" }, endDp: 1,
      series: [
        { name: "Produced in India", data: p(C.production), role: "ctx" },
        { name: "Imported", data: p(C.imports), role: "lead" },
      ],
    }),
  });
}

/** § 08: export growth in dollars and in rupees, year on year. */
export function ccy() {
  const R = ccyRows(), p = (k) => R.map((r) => [r.d, r[k] == null ? null : r1(r[k])]);
  return figure({
    bare: true, file: "india-atlas_trade-growth-dollars-rupees",
    label: `Growth of India's merchandise exports over the previous year, in US dollars and in rupees, per cent, financial years ${fyOf(R[0].d)} to ${fyOf(R.at(-1).d)}`,
    data: { cols: ["financial_year", "export_growth_usd_pct", "export_growth_inr_pct"], rows: R.map((r) => [fyOf(r.d), +r.usd.toFixed(2), r.inr == null ? null : +r.inr.toFixed(2)]) },
    draw: (width) => K.line({
      width, freq: "fy", unit: { suffix: "%" }, endDp: 1,
      series: [
        { name: "Rupees", data: p("inr"), role: "comp" },
        { name: "Dollars", data: p("usd"), role: "lead" },
      ],
    }),
  });
}
