// UPI guide (NPCI): the bundles and every computed figure the page and its charts print, in one
// place, so src/pages/guides/upi.astro, src/dossiers/upi.charts.js and scripts/qc.mjs read the same
// numbers. Runs at build time only. Bundles: data/series/npci-*.json (scripts/lib/products/npci.mjs)
// and, for the cross-check plate, the RBI's payments-monthly.
//
// Everything computed here is a ratio or a sum of NPCI's own printed figures, and the page says so
// where it shows one: averages are value ÷ number; app shares are an app's payments ÷ all apps'
// payments in NPCI's app table that month; state shares are a state's payments ÷ the payments NPCI
// assigned to any state (the unassigned remainder is shown on its own); the e-RUPI bank total is the
// sum of the banks NPCI lists, since it prints no total after December 2023.
import fs from "node:fs";
import path from "node:path";
import * as F from "./payments.fmt.js";
import { vintageText } from "../../scripts/lib/vintage.mjs";

const ROOT = process.cwd();
const load = (s) => JSON.parse(fs.readFileSync(path.join(ROOT, "data/series", s + ".json"), "utf8"));
export const B = {
  upi: load("npci-upi"), p2p: load("npci-upi-p2p-p2m"), apps: load("npci-upi-apps"), mcc: load("npci-upi-mcc"), seg: load("npci-upi-segments"),
  states: load("npci-upi-states"), districts: load("npci-upi-districts"), daily: load("npci-daily"), imps: load("npci-imps"), netc: load("npci-netc"),
  aeps: load("npci-aeps"), nachCr: load("npci-nach-credit"), nachDr: load("npci-nach-debit"), mms: load("npci-nach-mandates"), cts: load("npci-cts"),
  ctsGrids: load("npci-cts-grids"), bhim: load("npci-bhim"), bhimOld: load("npci-bhim-2016"), erupi: load("npci-erupi"), rbi: load("payments-monthly"),
};

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
export const monthOf = (iso) => `${MONTHS[+iso.slice(5, 7) - 1]} ${iso.slice(0, 4)}`;
export const dayOf = (iso) => `${+iso.slice(8, 10)} ${MONTHS[+iso.slice(5, 7) - 1]} ${iso.slice(0, 4)}`;
const S = (b, k) => b.series[k].data;
const lastIdx = (arr) => { for (let i = arr.length - 1; i >= 0; i--) if (arr[i] != null) return i; return -1; };
const at = (b, k, i = -1) => (i < 0 ? S(b, k).at(i) : S(b, k)[i]);
const yago = (b, k) => { const i = b.dates.length - 1, d = b.dates[i], j = b.dates.indexOf(`${+d.slice(0, 4) - 1}${d.slice(4)}`); return j < 0 ? null : S(b, k)[j]; };
export const pct = (v, dp = 1) => v.toFixed(dp) + "%";

// app display names: NPCI's labels, spelt as the apps spell themselves
import { APP_NAME } from "../../scripts/lib/products/npci-names.mjs";
// merchant categories: short names for NPCI's ISO MCC descriptions
const MCC_SHORT = { 5411: "Grocery shops", 5814: "Fast food", 5812: "Restaurants", 4814: "Telecom (recharges, bills)", 5541: "Fuel stations", 5462: "Bakeries", 5993: "Cigarette and paan shops",
  5912: "Pharmacies", 5451: "Dairies", 5412: "Digital gold", 7322: "Loan repayments", 5921: "Liquor shops", 5262: "Online marketplaces", 9399: "Government services",
  4900: "Utilities (power, gas, water)", 5441: "Sweets and confectionery", 5422: "Meat shops", 5331: "Variety stores", 5815: "Digital media", 6211: "Stockbrokers", 5813: "Bars",
  7230: "Beauty and barber shops", 5651: "Family clothing", 7622: "Electronics repair", 5732: "Electronics shops", 5311: "Department stores", 5691: "Clothing shops", 4121: "Taxis",
  4112: "Railways", 5499: "Food stores, other", 5399: "General merchandise", 7299: "Personal services", 8999: "Professional services", 5944: "Jewellery", 6300: "Insurance",
  8299: "Schools and education", 4111: "Local transport", 5983: "Fuel dealers", 7011: "Hotels", 8062: "Hospitals", 8011: "Doctors", 5200: "Home supplies", 5999: "Retail, other", 7399: "Business services", 6012: "Financial institutions" };
const firstClause = (s) => s.replace(/\s*\(MCC \d+\),.*$/, "").replace(/,.*$/, "");

export const U = (() => {
  const u = B.upi, U = {};
  // ---- UPI ----
  const L = u.dates.length - 1;
  U.upi = { n: at(u, "volume"), v: at(u, "value"), n0: S(u, "volume").find((v) => v > 0), firstMonth: monthOf(u.dates[S(u, "volume").findIndex((v) => v > 0)]), month: monthOf(u.dates[L]),
    nYago: yago(u, "volume"), vYago: yago(u, "value"), banks: at(u, "banks_live"), banks0: S(u, "banks_live").find((v) => v != null) };
  U.upi.avg = U.upi.v / U.upi.n;
  // averages start once UPI handled ten lakh payments a month (the first months' handful of payments give a meaningless average)
  U.ticket = { from: u.dates[S(u, "volume").findIndex((v) => v >= 1e6)] };
  const avgs = u.dates.map((d, i) => (d < U.ticket.from ? null : S(u, "value")[i] / S(u, "volume")[i]));
  let mi = avgs.findIndex((v) => v != null), lo = mi; avgs.forEach((v, i) => { if (v != null && v > avgs[mi]) mi = i; if (v != null && v < avgs[lo]) lo = i; });
  Object.assign(U.ticket, { first: avgs.find((v) => v != null), firstMonth: monthOf(U.ticket.from), max: avgs[mi], maxMonth: monthOf(u.dates[mi]), min: avgs[lo], minMonth: monthOf(u.dates[lo]) });
  // ---- P2P and P2M ----
  const p = B.p2p, PL = p.dates.length - 1;
  U.p2p = { firstMonth: monthOf(p.dates[0]), month: monthOf(p.dates[PL]),
    shareN: (100 * at(p, "p2m_volume")) / at(p, "total_volume"), shareV: (100 * at(p, "p2m_value")) / at(p, "total_value"),
    shareN0: (100 * S(p, "p2m_volume")[0]) / S(p, "total_volume")[0], shareV0: (100 * S(p, "p2m_value")[0]) / S(p, "total_value")[0],
    avgP2P: at(p, "p2p_value") / at(p, "p2p_volume"), avgP2M: at(p, "p2m_value") / at(p, "p2m_volume"),
    avgP2P0: S(p, "p2p_value")[0] / S(p, "p2p_volume")[0], avgP2M0: S(p, "p2m_value")[0] / S(p, "p2m_volume")[0],
    p2m: at(p, "p2m_volume"), p2p: at(p, "p2p_volume") };
  U.p2p.cross = (() => { const i = p.dates.findIndex((d, j) => S(p, "p2m_volume")[j] > S(p, "p2p_volume")[j]); return i < 0 ? null : monthOf(p.dates[i]); })();
  // ---- daily ----
  const dly = B.daily, DU = S(dly, "upi_volume");
  let dm = 0; DU.forEach((v, i) => { if (v != null && v > DU[dm]) dm = i; });
  const dl = lastIdx(DU);
  U.daily = { max: DU[dm], maxDay: dayOf(dly.dates[dm]), last: DU[dl], lastDay: dayOf(dly.dates[dl]), first: DU[0], firstDay: dayOf(dly.dates[0]) };
  // ---- apps ----
  const a = B.apps, AL = a.dates.length - 1;
  const codes = [...new Set(Object.keys(a.series).filter((k) => k.endsWith("__total_volume")).map((k) => k.slice(0, -"__total_volume".length)))];
  const sum = (i) => codes.reduce((s, c) => s + (S(a, c + "__total_volume")[i] ?? 0), 0);
  const tot = a.dates.map((_, i) => sum(i));
  const nameOf = (c) => APP_NAME[c] ?? (/^others/.test(c) ? "Other apps" : a.series[c + "__total_volume"].label.replace(/, all transactions \(number\)$/, ""));
  const shareLine = (c) => a.dates.map((d, i) => [d, S(a, c + "__total_volume")[i] == null ? null : (100 * S(a, c + "__total_volume")[i]) / tot[i]]);
  const LINES = [["phonepe", "lead", null, "PhonePe"], ["googlepay", "comp", null, "Google Pay"], ["paytm", "cat", "#00897A", "Paytm"], ["paytmpaymentsbankapp", "cat", "#93479A", "Paytm Payments Bank"], ["navi", "cat", "#B57D00", "Navi"]];
  const named = new Set(LINES.map((l) => l[0]));
  U.apps = { month: monthOf(a.dates[AL]), firstMonth: monthOf(a.dates[0]), total: tot[AL], count: codes.filter((c) => S(a, c + "__total_volume")[AL] != null && !/^others/.test(c)).length,
    lines: [...LINES.map(([c, role, color, short]) => ({ key: c, name: nameOf(c), short, role, color, data: shareLine(c) })),
      { key: "all_other_apps", name: "All other apps", short: "All others", role: "ctx", color: null, data: a.dates.map((d, i) => [d, (100 * codes.filter((c) => !named.has(c)).reduce((s, c) => s + (S(a, c + "__total_volume")[i] ?? 0), 0)) / tot[i]]) }] };
  U.apps.latest = codes.filter((c) => S(a, c + "__total_volume")[AL] != null).map((c) => ({ key: c, name: nameOf(c), volume: S(a, c + "__total_volume")[AL], value: S(a, c + "__total_value")[AL], share: (100 * S(a, c + "__total_volume")[AL]) / tot[AL] }))
    .filter((r) => !/^others/.test(r.key)).sort((x, y) => y.volume - x.volume).map((r, i) => ({ ...r, rank: i }));
  U.apps.top2 = U.apps.latest[0].share + U.apps.latest[1].share;
  U.apps.top2First = (() => { const s0 = codes.map((c) => S(a, c + "__total_volume")[0] ?? 0).filter((v) => v).sort((x, y) => y - x); return (100 * (s0[0] + s0[1])) / tot[0]; })();
  // who starts the payment: customers, or businesses paying customers (refunds, cashbacks, payouts) or other businesses
  const kindSum = (k) => codes.reduce((s2, c) => s2 + (a.series[`${c}__${k}_volume`]?.data[AL] ?? 0), 0);
  U.apps.customerShare = (100 * kindSum("customer")) / tot[AL]; U.apps.b2cShare = (100 * kindSum("b2c")) / tot[AL]; U.apps.b2bShare = (100 * kindSum("b2b")) / tot[AL];
  U.apps.b2c = codes.map((c) => ({ key: c, name: nameOf(c), b2c: a.series[`${c}__b2c_volume`]?.data[AL] ?? null, b2cValue: a.series[`${c}__b2c_value`]?.data[AL] ?? null, total: S(a, `${c}__total_volume`)[AL] }))
    .filter((r) => r.b2c > 0 && !/^others/.test(r.key)).sort((x, y) => y.b2c - x.b2c);
  // ---- merchant categories ----
  const m = B.mcc, ML = m.dates.length - 1;
  const mcodes = [...new Set(Object.keys(m.series).filter((k) => /^mcc_\d+__volume$/.test(k)).map((k) => k.slice(4, -8)))];
  const mrow = (c, i = ML) => ({ code: c, name: firstClause(m.series[`mcc_${c}__volume`].label), short: MCC_SHORT[c] ?? firstClause(m.series[`mcc_${c}__volume`].label), volume: S(m, `mcc_${c}__volume`)[i], value: S(m, `mcc_${c}__value`)[i] });
  const listed = mcodes.map((c) => mrow(c)).filter((r) => r.volume != null);
  U.mcc = { month: monthOf(m.dates[ML]), total: at(m, "total__volume"), totalV: at(m, "total__value"), others: at(m, "others__volume"), othersV: at(m, "others__value"), listed: listed.length,
    latest: listed.slice().sort((x, y) => y.volume - x.volume), byValue: listed.slice().sort((x, y) => y.value - x.value), all: listed.slice().sort((x, y) => y.volume - x.volume) };
  const g = mrow("5411");
  U.mcc.grocery = { volume: g.volume, value: g.value, share: (100 * g.volume) / U.mcc.total, avg: g.value / g.volume };
  U.mcc.biggestTicket = U.mcc.latest.slice(0, 20).reduce((x, y) => (y.value / y.volume > x.value / x.volume ? y : x));
  U.mcc.smallestTicket = U.mcc.latest.slice(0, 20).reduce((x, y) => (y.value / y.volume < x.value / x.volume ? y : x));
  U.mcc.trend = [5411, 5814, 5812, 4814, 5541, 5912, 5462, 7322].map((c) => ({ key: `mcc_${c}__volume`, code: String(c), name: MCC_SHORT[c], sub: `MCC ${c}, crore a month` }));
  // ---- segments ----
  const sg = B.seg;
  U.segments = [["public_transport", "Public transport", "bus, rail, taxi, air"], ["government_services", "Government", "payments and services"], ["utility", "Utilities", "water, gas, electricity"],
    ["education", "Education", "schools, colleges, fees"], ["hospital", "Hospitals", "and healthcare"], ["agriculture", "Agriculture", "and allied services"]].map(([key, name, sub]) => ({ key, name, sub: sub + ", a month" }));
  U.seg = { month: monthOf(sg.dates.at(-1)), firstMonth: monthOf(sg.dates[0]), transport: at(sg, "public_transport__volume") ?? S(sg, "public_transport__volume")[lastIdx(S(sg, "public_transport__volume"))] };
  // ---- states ----
  const st = B.states, SL = st.dates.length - 1;
  const groups = [...new Set(Object.keys(st.series).map((k) => k.split("__")[0]))].filter((x) => x !== "unclassified");
  const assigned = groups.reduce((s2, x) => s2 + (S(st, x + "__volume")[SL] ?? 0), 0), assignedV = groups.reduce((s2, x) => s2 + (S(st, x + "__value")[SL] ?? 0), 0);
  U.states = { month: monthOf(st.dates[SL]), assigned, avgAll: assignedV / assigned,
    rows: groups.map((x) => ({ key: x, name: st.series[x + "__volume"].group, tile: st.series[x + "__volume"].tile, volume: S(st, x + "__volume")[SL], value: S(st, x + "__value")[SL] }))
      .map((r) => ({ ...r, shareOfAssigned: (100 * r.volume) / assigned, avg: r.value / r.volume })).sort((x, y) => y.volume - x.volume).map((r, i) => ({ ...r, rank: i })) };
  const byAvg = U.states.rows.slice().sort((x, y) => y.avg - x.avg);
  Object.assign(U.states, { top: U.states.rows[0], second: U.states.rows[1], hiAvg: byAvg[0], loAvg: byAvg.at(-1), top5: U.states.rows.slice(0, 5).reduce((s2, r) => s2 + r.shareOfAssigned, 0) });
  U.unassigned = { line: st.dates.map((d, i) => { const un = S(st, "unclassified__volume")[i], all = un + groups.reduce((s2, x) => s2 + (S(st, x + "__volume")[i] ?? 0), 0); return [d, un == null ? null : (100 * un) / all]; }),
    first: monthOf(st.dates[0]), month: monthOf(st.dates[SL]) };
  U.unassigned.now = U.unassigned.line[SL][1]; U.unassigned.start = U.unassigned.line[0][1];
  // ---- districts ----
  const di = B.districts, DL = di.dates.length - 1;
  const dkeys = Object.keys(di.series).filter((k) => k.endsWith("__volume") && !k.endsWith("_share"));
  U.districts = { month: monthOf(di.dates[DL]), firstMonth: monthOf(di.dates[0]),
    all: dkeys.map((k) => { const s2 = di.series[k], base = k.slice(0, -"__volume".length), [district] = s2.label.split(":"); return { name: district.replace(/, [^,]+$/, "") + ", " + s2.group, district: district.replace(/, [^,]+$/, ""), state: s2.group, volume: S(di, k)[DL], value: S(di, base + "__value")[DL] }; })
      .filter((r) => r.volume != null).sort((x, y) => y.volume - x.volume) };
  U.districts.count = U.districts.all.length; U.districts.top = U.districts.all.slice(0, 25);
  U.districts.top25 = (100 * U.districts.top.reduce((s2, r) => s2 + r.volume, 0)) / U.districts.all.reduce((s2, r) => s2 + r.volume, 0);
  // ---- IMPS, NACH, mandates, FASTag, AePS, cheques, ATMs, BHIM, e-RUPI ----
  const im = B.imps;
  U.imps = { n: at(im, "volume"), v: at(im, "value"), month: monthOf(im.dates.at(-1)), firstMonth: monthOf(im.dates[0]), avg: at(im, "value") / at(im, "volume"), avg0: S(im, "value")[0] / S(im, "volume")[0], nYago: yago(im, "volume") };
  const nd = B.nachDr, rate = nd.dates.map((d, i) => (S(nd, "total_debit__presented")[i] ? (100 * S(nd, "total_debit__returned")[i]) / S(nd, "total_debit__presented")[i] : null));
  let rmax = rate.findIndex((v) => v != null); rate.forEach((v, i) => { if (v != null && v > rate[rmax]) rmax = i; });
  U.nach = { firstMonth: monthOf(nd.dates[S(nd, "total_debit__presented").findIndex((v) => v != null)]), dr: at(nd, "total_debit__presented"), drV: at(nd, "total_debit__presented_value"), month: monthOf(nd.dates.at(-1)), rate: rate.at(-1), rateMax: rate[rmax], rateMaxMonth: monthOf(nd.dates[rmax]),
    rateYago: rate[nd.dates.length - 13], returned: at(nd, "total_debit__returned") };
  const nc = B.nachCr;
  U.nachCr = { apbs: at(nc, "apbs__dbt__successful"), apbsV: at(nc, "apbs__dbt__successful_value"), other: at(nc, "credit_306__other_credits__successful"), otherV: at(nc, "credit_306__other_credits__successful_value"), month: monthOf(nc.dates.at(-1)) };
  const mm = B.mms;
  U.mms = { firstMonth: monthOf(mm.dates[0]), n: at(mm, "processed"), month: monthOf(mm.dates.at(-1)), rate: (100 * at(mm, "rejected")) / at(mm, "processed") };
  const ne = B.netc;
  U.netc = { firstMonth: monthOf(ne.dates[0]), n: at(ne, "volume"), v: at(ne, "value"), pass: at(ne, "annual_pass_volume"), tags: at(ne, "tags_issued"), month: monthOf(ne.dates.at(-1)), avg: at(ne, "value") / at(ne, "volume") };
  const ae = B.aeps, aT = S(ae, "total"); let am = 0; aT.forEach((v, i) => { if (v != null && v > aT[am]) am = i; });
  U.aeps = { firstMonth: monthOf(ae.dates[0]), n: at(ae, "total"), offus: at(ae, "offus_volume"), onus: at(ae, "onus_volume"), bap: at(ae, "bhim_aadhaar_pay_volume"), ekyc: at(ae, "ekyc"), month: monthOf(ae.dates.at(-1)),
    max: aT[am], maxMonth: monthOf(ae.dates[am]), offusAvg: at(ae, "offus_value") / at(ae, "offus_volume") };
  const ct = B.cts, cg = B.ctsGrids;
  U.cts = { n: at(ct, "presented"), v: at(ct, "presented_value"), rate: at(ct, "return_rate"), month: monthOf(ct.dates.at(-1)), firstMonth: monthOf(ct.dates[0]),
    n0: S(ct, "presented")[0], avg: at(ct, "presented_value") / at(ct, "presented"), gridsFrom: monthOf(cg.dates[0]), gridsTo: monthOf(cg.dates.at(-1)) };
  const nf = S(dly, "nfs_volume"), nl = lastIdx(nf);
  U.nfs = { last: nf[nl], lastDay: dayOf(dly.dates[nl]), first: nf[0], firstDay: dayOf(dly.dates[0]),
    skipped: dly.dates.filter((d, i) => { const v = nf[i]; if (v == null) return false; const nb = nf.slice(Math.max(0, i - 7), i + 8).filter((x, j) => j !== Math.min(7, i) && x != null).sort((x, y) => x - y); const med = nb[nb.length >> 1]; return med > 0 && v > 5 * med; }).map(dayOf) };
  const bh = B.bhim, bo = B.bhimOld;
  U.bhim = { n: at(bh, "volume"), month: monthOf(bh.dates.at(-1)), share: (100 * at(bh, "volume")) / S(u, "volume")[u.dates.indexOf(bh.dates.at(-1))],
    share0: (100 * S(bh, "volume")[0]) / S(u, "volume")[u.dates.indexOf(bh.dates[0])], firstMonth: monthOf(bh.dates[0]), oldFirst: monthOf(bo.dates[0]) };
  const er = B.erupi, bankKeys = Object.keys(er.series).filter((k) => k.endsWith("__created") && er.series[k].group.startsWith("Issuing bank"));
  U.erupi = { total: er.dates.map((d, i) => [d, er.series.total__created?.data[i] ?? null]),
    banks: er.dates.map((d, i) => [d, d < "2024-01-01" ? null : bankKeys.reduce((s2, k) => s2 + (er.series[k].data[i] ?? 0), 0)]) };
  U.erupi.last = U.erupi.banks.at(-1)[1]; U.erupi.month = monthOf(er.dates.at(-1)); U.erupi.banksN = bankKeys.length;
  // ---- NPCI against the RBI ----
  const r = B.rbi;
  U.rbi = { rows: [], diff: [] };
  u.dates.forEach((d, i) => { const j = r.dates.indexOf(d); if (j < 0) return; const a2 = S(u, "volume")[i], c = r.series.upi_volume.data[j]; if (a2 == null || c == null) return;
    const df = (100 * (a2 - c)) / c; U.rbi.rows.push([d, a2, c, +df.toFixed(4)]); U.rbi.diff.push([d, df]); });
  U.rbi.worst = U.rbi.diff.reduce((x, y) => (Math.abs(y[1]) > Math.abs(x[1]) ? y : x));
  U.rbi.within = U.rbi.diff.filter(([, v]) => Math.abs(v) <= 0.5).length; U.rbi.n = U.rbi.diff.length; U.rbi.from = monthOf(U.rbi.diff[0][0]); U.rbi.to = monthOf(U.rbi.diff.at(-1)[0]);
  // ---- growth on a year earlier: each month against the same month a year before, within one
  // table (never across a change in what NPCI counts). UPI from April 2018, once its year-earlier
  // base was past the launch years (growth above 1,000% a year to 2018-19); the comparison panels
  // from April 2023, past the 2020 and 2021 lockdowns' base effects and FASTag's compulsory rollout ----
  const yoyLine = (b, k, from) => b.dates.map((d, i) => {
    if (d < from) return [d, null];
    const j = b.dates.indexOf(`${+d.slice(0, 4) - 1}${d.slice(4)}`), x = S(b, k)[i], y = j < 0 ? null : S(b, k)[j];
    return [d, x == null || y == null || y === 0 ? null : 100 * (x / y - 1)];
  });
  const lastPt = (P) => P.filter((q) => q[1] != null).at(-1);
  const vol = yoyLine(u, "volume", "2019-04-01"), val = yoyLine(u, "value", "2019-04-01");
  const vL = lastPt(vol), vY = vol.find((q) => q[0] === `${+vL[0].slice(0, 4) - 1}${vL[0].slice(4)}`);
  const firstFy = vol.filter((q) => q[0] >= "2019-04-01" && q[0] < "2020-04-01" && q[1] != null);
  U.yoy = { from: monthOf("2019-04-01"), month: monthOf(vL[0]), vol, val, v: vL[1], val1: lastPt(val)[1], vYago: vY?.[1] ?? null,
    first: firstFy.reduce((a, q) => a + q[1], 0) / firstFy.length, fewer: vol.filter((q) => q[1] != null && q[1] < vL[1]).length, n: vol.filter((q) => q[1] != null).length };
  const NET = [["upi", "UPI", "payments", B.upi, "volume"], ["imps", "IMPS", "transfers", B.imps, "volume"], ["netc", "FASTag", "paid toll and parking trips", B.netc, "volume"], ["nach", "NACH debits", "EMIs, SIPs and bills presented", B.nachDr, "total_debit__presented"]];
  U.yoyNet = NET.map(([key, name, what, b, k]) => { const P = yoyLine(b, k, "2023-04-01"), L = lastPt(P); return { key, name, what, data: P, last: L[1], month: monthOf(L[0]) }; });
  return U;
})();

// ---- every number the page prints, by element id (qc.mjs checks the rendered page against these
// and recomputes the title block independently) ----
const g = (a2, b2) => F.growth(a2, b2);
const pcU = (txt) => txt.replace(/^(₹?[\d,.]+)( .+)$/, '$1<span class="pc">$2</span>');
const sg = (v) => (v < 0 ? "−" : "+") + Math.abs(v).toFixed(1) + "%";
const net = (k) => U.yoyNet.find((x) => x.key === k);
export const N = {
  // § 04 growth
  "pv-yoy": sg(U.yoy.v), "ex-yy-v": sg(U.yoy.v), "ex-yy-val": sg(U.yoy.val1), "ex-yy-vy": U.yoy.vYago == null ? "—" : sg(U.yoy.vYago), "ex-yy-first": sg(U.yoy.first),
  "pv-yoy-net": sg(net("imps").last), "ex-yn-upi": sg(net("upi").last), "ex-yn-imps": sg(net("imps").last), "ex-yn-netc": sg(net("netc").last), "ex-yn-nach": sg(net("nach").last),
  "n-upi": pcU(F.crore(U.upi.n)), "d-upi": `<b>${g(U.upi.n, U.upi.nYago)}</b> on a year earlier`,
  "n-upiv": pcU(F.lakhCrore(U.upi.v)), "d-upiv": `<b>${g(U.upi.v, U.upi.vYago)}</b> on a year earlier`,
  "n-avg": F.rupees(U.upi.avg), "d-avg": `<b>${F.rupees(U.p2p.avgP2M)}</b> to a merchant`,
  "n-p2m": pct(U.p2p.shareN), "d-p2m": `<b>${pct(U.p2p.shareN0)}</b> in ${U.p2p.firstMonth}`,
  // § 01
  "pv-growth": F.crore(U.upi.n), "ex-gr-n": F.crore(U.upi.n), "ex-gr-v": F.lakhCrore(U.upi.v), "ex-gr-g": g(U.upi.n, U.upi.nYago), "ex-gr-n0": F.count(U.upi.n0), "ex-gr-banks": U.upi.banks.toLocaleString("en-IN"), "ex-gr-banks0": U.upi.banks0.toLocaleString("en-IN"),
  "pv-ticket": F.rupees(U.upi.avg), "ex-tk-all": F.rupees(U.upi.avg), "ex-tk-p2p": F.rupees(U.p2p.avgP2P), "ex-tk-p2m": F.rupees(U.p2p.avgP2M), "ex-tk-max": F.rupees(U.ticket.max), "ex-tk-p2m0": F.rupees(U.p2p.avgP2M0), "ex-tk-p2p0": F.rupees(U.p2p.avgP2P0),
  "pv-p2m": pct(U.p2p.shareN), "ex-pm-n": pct(U.p2p.shareN), "ex-pm-v": pct(U.p2p.shareV), "ex-pm-n0": pct(U.p2p.shareN0), "ex-pm-v0": pct(U.p2p.shareV0),
  "pv-daily": F.crore(U.daily.max), "ex-dy-max": F.crore(U.daily.max), "ex-dy-last": F.crore(U.daily.last), "ex-dy-first": F.crore(U.daily.first),
  // § 02 apps
  "pv-apps": pct(U.apps.top2), "ex-ap-1": pct(U.apps.latest[0].share), "ex-ap-2": pct(U.apps.latest[1].share), "ex-ap-3": pct(U.apps.latest[2].share), "ex-ap-top2": pct(U.apps.top2), "ex-ap-top20": pct(U.apps.top2First), "ex-ap-n": String(U.apps.count),
  "ex-ap-1n": U.apps.latest[0].name, "ex-ap-2n": U.apps.latest[1].name, "ex-ap-3n": U.apps.latest[2].name,
  "pv-apps-latest": pct(U.apps.latest[0].share), "pv-apps-kind": pct(U.apps.customerShare), "ex-ak-c": pct(U.apps.customerShare), "ex-ak-b2c": pct(U.apps.b2cShare, 2), "ex-ak-1": U.apps.b2c[0].name, "ex-ak-1v": F.count(U.apps.b2c[0].b2c),
  // § 03 merchants
  "pv-mcc": F.crore(U.mcc.grocery.volume), "ex-mc-gr": F.crore(U.mcc.grocery.volume), "ex-mc-grs": pct(U.mcc.grocery.share), "ex-mc-n": String(U.mcc.listed), "ex-mc-oth": pct((100 * U.mcc.others) / U.mcc.total),
  "pv-mcc-ticket": F.rupees(U.mcc.grocery.avg), "ex-mt-gr": F.rupees(U.mcc.grocery.avg), "ex-mt-hi": F.rupees(U.mcc.biggestTicket.value / U.mcc.biggestTicket.volume), "ex-mt-hin": U.mcc.biggestTicket.short,
  "ex-mt-lo": F.rupees(U.mcc.smallestTicket.value / U.mcc.smallestTicket.volume), "ex-mt-lon": U.mcc.smallestTicket.short,
  "pv-mcc-trend": F.crore(U.mcc.grocery.volume), "pv-seg": F.count(U.seg.transport),
  // § 04 states
  "pv-map": pct(U.states.top.shareOfAssigned), "ex-st-1": U.states.top.name, "ex-st-1s": pct(U.states.top.shareOfAssigned), "ex-st-2": U.states.second.name, "ex-st-2s": pct(U.states.second.shareOfAssigned), "ex-st-top5": pct(U.states.top5),
  "pv-states": F.rupees(U.states.avgAll), "ex-sr-hi": U.states.hiAvg.name, "ex-sr-hiv": F.rupees(U.states.hiAvg.avg), "ex-sr-lo": U.states.loAvg.name, "ex-sr-lov": F.rupees(U.states.loAvg.avg), "ex-sr-all": F.rupees(U.states.avgAll),
  "pv-unassigned": pct(U.unassigned.now), "ex-un-now": pct(U.unassigned.now), "ex-un-0": pct(U.unassigned.start),
  "pv-districts": F.crore(U.districts.top[0].volume), "ex-di-1": U.districts.top[0].name, "ex-di-1v": F.crore(U.districts.top[0].volume), "ex-di-n": U.districts.count.toLocaleString("en-IN"), "ex-di-25": pct(U.districts.top25),
  // § 05 other networks
  "pv-imps": F.crore(U.imps.n), "ex-im-n": F.crore(U.imps.n), "ex-im-v": F.lakhCrore(U.imps.v), "ex-im-avg": F.rupees(U.imps.avg), "ex-im-avg0": F.rupees(U.imps.avg0), "ex-im-g": g(U.imps.n, U.imps.nYago),
  "pv-nach-dr": pct(U.nach.rate), "ex-nd-n": F.crore(U.nach.dr), "ex-nd-v": F.lakhCrore(U.nach.drV), "ex-nd-r": pct(U.nach.rate), "ex-nd-ry": pct(U.nach.rateYago), "ex-nd-rmax": pct(U.nach.rateMax), "ex-nd-rmaxm": U.nach.rateMaxMonth, "ex-nd-ret": F.crore(U.nach.returned),
  "pv-nach-cr": F.crore(U.nachCr.apbs), "ex-nc-apbs": F.crore(U.nachCr.apbs), "ex-nc-apbsv": F.rsCrore(U.nachCr.apbsV), "ex-nc-oth": F.crore(U.nachCr.other), "ex-nc-othv": F.lakhCrore(U.nachCr.otherV),
  "pv-mms": pct(U.mms.rate), "ex-mm-n": F.count(U.mms.n), "ex-mm-r": pct(U.mms.rate),
  "pv-fastag": F.crore(U.netc.n), "ex-ft-n": F.crore(U.netc.n), "ex-ft-v": F.rsCrore(U.netc.v), "ex-ft-avg": F.rupees(U.netc.avg), "ex-ft-pass": F.crore(U.netc.pass), "ex-ft-tags": F.crore(U.netc.tags),
  "pv-aeps": F.crore(U.aeps.n), "ex-ae-n": F.crore(U.aeps.n), "ex-ae-off": F.crore(U.aeps.offus), "ex-ae-on": F.crore(U.aeps.onus), "ex-ae-max": F.crore(U.aeps.max), "ex-ae-maxm": U.aeps.maxMonth, "ex-ae-avg": F.rupees(U.aeps.offusAvg), "ex-ae-ekyc": F.crore(U.aeps.ekyc),
  "pv-cheques": pct(U.cts.rate), "ex-cq-n": F.crore(U.cts.n), "ex-cq-v": F.lakhCrore(U.cts.v), "ex-cq-r": pct(U.cts.rate), "ex-cq-avg": F.rupees(U.cts.avg), "ex-cq-n0": F.crore(U.cts.n0),
  "pv-atm": F.lakh(U.nfs.last), "ex-at-last": F.lakh(U.nfs.last), "ex-at-first": F.lakh(U.nfs.first),
  "pv-bhim": pct(U.bhim.share, 2), "ex-bh-s": pct(U.bhim.share, 2), "ex-bh-s0": pct(U.bhim.share0, 2), "ex-bh-n": F.crore(U.bhim.n),
  "pv-erupi": F.count(U.erupi.last), "ex-er-last": F.count(U.erupi.last), "ex-er-banks": String(U.erupi.banksN),
  "pv-rbi": (U.rbi.worst[1] < 0 ? "−" : "+") + Math.abs(U.rbi.worst[1]).toFixed(2) + "%", "ex-rb-within": String(U.rbi.within), "ex-rb-n": String(U.rbi.n),
};

// plate titles that state a finding are written from the numbers, so a title can never outlive them
const share2 = (v) => (v >= 75 ? "about three in four" : v >= 66 ? "about two in three" : v >= 55 ? "more than half" : v >= 45 ? "about half" : v >= 30 ? "about a third" : "a minority");
const words = ["no", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve"];
const over2 = U.apps.latest.filter((r) => r.share >= 2).length;
const nachIn = Math.round(100 / U.nach.rate);
export const T = {
  "h-yoy": `UPI payments grew ${sg(U.yoy.v)} on a year earlier in ${U.yoy.month}, against ${sg(U.yoy.first)} on average in 2019-20`,
  "h-p2m": U.p2p.shareN > 50 && U.p2p.shareV < 50 ? "Most UPI payments now go to shops; most UPI money still goes to people" : `Shops receive ${pct(U.p2p.shareN)} of UPI payments and ${pct(U.p2p.shareV)} of the money`,
  "h-ticket": `A UPI payment to a shop averages ${F.rupees(U.p2p.avgP2M)}; a transfer to a person, ${F.rupees(U.p2p.avgP2P)}`,
  "h-apps": `The two biggest apps make ${pct(U.apps.top2)} of UPI payments; in ${U.apps.firstMonth} they made ${pct(U.apps.top2First)}`,
  "h-apps-latest": `${words[over2] ?? over2} app${over2 === 1 ? "" : "s"} make two or more in a hundred UPI payments; every other app, fewer`.replace(/^./, (c) => c.toUpperCase()),
  "h-apps-kind": `Customers start ${pct(U.apps.customerShare)} of UPI payments; businesses paying out use bank apps`,
  "h-mcc": U.mcc.latest[0].code === U.mcc.byValue[0].code ? `${U.mcc.latest[0].short} lead by number of payments and by money; ${U.mcc.byValue[1].short.toLowerCase()} come next by money` : `${U.mcc.latest[0].short} lead by number of payments; ${U.mcc.byValue[0].short.toLowerCase()} by money`,
  "h-mcc-ticket": `From ${F.rupees(U.mcc.smallestTicket.value / U.mcc.smallestTicket.volume)} at ${U.mcc.smallestTicket.short.toLowerCase()} to ${F.rupees(U.mcc.biggestTicket.value / U.mcc.biggestTicket.volume)} at ${U.mcc.biggestTicket.short.toLowerCase()}`,
  "h-unassigned": `Read this first: ${pct(U.unassigned.now)} of UPI payments have no state, up from ${pct(U.unassigned.start)}`,
  "h-map": `The top five states hold ${pct(U.states.top5)} of the UPI payments that have a state`,
  "h-imps": `The average IMPS transfer is ${F.rupees(U.imps.avg)}, against ${F.rupees(U.imps.avg0)} in ${U.imps.firstMonth}`,
  "h-nach-dr": `${pct(U.nach.rate)} of EMI, SIP and bill debits come back unpaid${nachIn >= 2 && nachIn <= 12 ? `, about one in ${words[nachIn]}` : ""}`,
  "h-mms": U.mms.rate > 50 ? `More NACH mandates are rejected than accepted: ${pct(U.mms.rate)}` : `${pct(U.mms.rate)} of NACH mandates are rejected`,
  "h-bhim": `NPCI's own app, BHIM, makes ${pct(U.bhim.share, 2)} of UPI payments`,
  "h-rbi": `NPCI's count of UPI and the RBI's differ by at most ${Math.abs(U.rbi.worst[1]).toFixed(2)}% in any month`,
};
const ALIAS = { "cr-n": "ex-gr-n", "cr-v": "ex-gr-v", "cr-g": "ex-gr-g", "cr-p2m": "ex-pm-n", "cr-p2mv": "ex-pm-v", "cr-a1": "ex-ap-1n", "cr-a2": "ex-ap-2n", "cr-top2": "ex-ap-top2", "cr-top20": "ex-ap-top20",
  "cr-un": "ex-un-now", "cr-un0": "ex-un-0", "cr-nd": "ex-nd-r", "cr-im": "ex-im-n", "cr-img": "ex-im-g", "pv-apps-latest2": "ex-ap-1", "pv-mcc-trend2": "ex-mc-gr", "ex-seg-t": "pv-seg", "prov-vintage2": "prov-vintage" };
const iso = B.upi.meta.archiveCapturedDate;
N["prov-captured"] = `${+iso.slice(8, 10)} ${MONTHS[+iso.slice(5, 7) - 1]} ${iso.slice(0, 4)}`;
N["prov-vintage"] = vintageText(B.upi.meta);
for (const [k, v] of Object.entries(ALIAS)) N[k] = N[v];
Object.assign(N, T);
