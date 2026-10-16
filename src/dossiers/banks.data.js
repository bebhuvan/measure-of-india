// src/dossiers/banks.data.js: build-time reader for the banks guide (src/pages/guides/banks.astro).
// The bank-by-bank bundles run to several megabytes (every bank, every item, three operations,
// fifty quarters), far past the page budget (docs/CONTRACT-render.md). The page reads them here
// at build time: src/dossiers/banks.charts.js draws the plates from bankData() and bankNumbers()
// sets every figure in the page's text, so the page ships finished SVG and HTML, no bundle JSON.
// Every value is a bundle's own, or a share computed from two of them (and said so on the plate).
import fs from "node:fs";
import path from "node:path";
import * as fmt from "../charts/format.js";

// Resolved from the working directory, like periods.js: Astro bundles this module into dist/.
const ROOT = process.cwd();
const cache = new Map();
export function load(slug) {
  if (!cache.has(slug)) cache.set(slug, JSON.parse(fs.readFileSync(path.join(ROOT, "data/series", slug + ".json"), "utf8")));
  return cache.get(slug);
}
const ser = (slug, key) => { const s = load(slug).series[key]; if (!s) throw new Error(`banks.data: ${slug} has no series ${key}`); return s; };
const val = (slug, key, iso) => { const b = load(slug); const i = b.dates.indexOf(iso); return i < 0 ? null : ser(slug, key).data[i]; };
const lastIso = (slug) => load(slug).dates.at(-1);
/** a series as [iso, value] pairs, published points only */
const pairs = (slug, key, from = null) => { const b = load(slug), s = ser(slug, key); return b.dates.map((d, i) => [d, s.data[i]]).filter(([d, v]) => v != null && (!from || d >= from)); };
const G = { psb: "Public sector banks", private: "Private sector banks", foreign: "Foreign banks", sfb: "Small finance banks", all: "All scheduled commercial banks" };
// the bank's name without the legal suffix, for chart rows ("HDFC Bank", "Axis Bank")
export const shortName = (n) => n.replace(/,?\s+(Limited|Ltd\.?|LTD\.?)$/i, "").replace(/[.,]$/, "").replace(/^Indusind/, "IndusInd").replace(/^Jpmorgan/, "JPMorgan").replace(/^Idbi/, "IDBI").trim();
const groupKey = (label) => Object.entries(G).find(([, l]) => l === label)?.[0] ?? "other";

export function bankData() {
  const D = {};
  const H = load("banks-health");
  D.healthDates = H.dates;
  const RA = load("banks-ratios");
  if (RA.dates.join() !== H.dates.join()) throw new Error("banks.data: banks-health and banks-ratios are on different axes");
  D.health = Object.fromEntries([...Object.entries(H.series), ...Object.entries(RA.series)].map(([k, s]) => [k, s.data]));
  D.latest = H.dates.at(-1);
  D.vintage = H.meta.vintage;
  // HDFC Bank's share of deposits stepped up in the quarter its parent merged in (June to September 2023)
  D.hdfcStep = val("banks-shares", "hdfc_bank_ltd__deposits", "2023-09-01") - val("banks-shares", "hdfc_bank_ltd__deposits", "2023-06-01");

  // shares of deposits and advances by group (domestic operations)
  D.shares = Object.fromEntries(["psb", "private", "foreign", "sfb"].flatMap((g) => ["deposits", "advances"].map((w) => [`${g}__${w}`, pairs("banks-shares", `${g}__${w}`)])));

  // the biggest banks by deposits in India, latest quarter, with their share then and at the start
  const bs = load("banks-balance-sheet"), sh = load("banks-shares");
  const L = bs.dates.at(-1), F = bs.dates[0];
  const rows = Object.entries(bs.series).filter(([k]) => k.endsWith("__total_deposits__domestic")).map(([k, s]) => {
    const id = k.replace("__total_deposits__domestic", "");
    const shs = sh.series[`${id}__deposits`];
    return { id, name: shortName(s.label.split(", total deposits")[0]), group: groupKey(s.group), dep: s.data.at(-1), share: shs?.data.at(-1) ?? null, share0: shs?.data[0] ?? null, merger: s.mergerNote ?? null };
  }).filter((r) => r.dep != null).sort((a, b) => b.dep - a.dep);
  D.biggest = rows.slice(0, 15);
  D.nBanks = rows.length;
  D.top5share = rows.slice(0, 5).reduce((a, r) => a + r.share, 0);
  D.bsLatest = L; D.bsFirst = F;

  // profit after tax by group, each financial year (the March figure: April to March)
  const pr = load("banks-groups-profitability");
  const marchIdx = pr.dates.map((d, i) => (d.endsWith("-03-01") ? i : -1)).filter((i) => i >= 0);
  D.profit = { years: marchIdx.map((i) => pr.dates[i]), ...Object.fromEntries(["all", "psb", "private", "foreign", "sfb"].map((g) => [g, marchIdx.map((i) => pr.series[`${g}__net_profit_loss_pat__global`]?.data[i] ?? pr.series[`${g}__net_profit_loss_pat__domestic`]?.data[i] ?? null)])) };

  // margins: what banks pay for money and what they earn on it, all banks (domestic)
  D.allRoa = pairs("banks-groups-performance", "all__return_on_total_assets_annualized__domestic").at(-1)[1];
  D.margins = { cost: pairs("banks-groups-performance", "all__cost_of_funds_annualized__domestic"), yield: pairs("banks-groups-performance", "all__yield_on_funds_annualized__domestic"), nim: pairs("banks-groups-performance", "all__net_interest_margin_nim_annualized__domestic") };

  // bank by bank: the 20 largest lenders by gross advances in India, their bad loans now and in March 2018, and return on assets
  const aq = load("banks-asset-quality"), pf = load("banks-performance");
  const AQL = aq.dates.at(-1), PEAK = "2018-03-01";
  const lenders = Object.entries(aq.series).filter(([k]) => k.endsWith("__gross_advances__domestic") && aq.series[k].data.at(-1) != null)
    .map(([k, s]) => ({ id: k.replace("__gross_advances__domestic", ""), adv: s.data.at(-1), group: groupKey(s.group) })).sort((a, b) => b.adv - a.adv).slice(0, 20);
  D.lenders = lenders.map((r) => ({ ...r, name: shortName(aq.series[`${r.id}__gross_advances__domestic`].label.split(", gross advances")[0]),
    now: aq.series[`${r.id}__gross_npas_to_gross_advances__domestic`]?.data.at(-1) ?? null, peak: val("banks-asset-quality", `${r.id}__gross_npas_to_gross_advances__domestic`, PEAK),
    roa: pf.series[`${r.id}__return_on_total_assets_annualized__domestic`]?.data.at(-1) ?? null, nim: pf.series[`${r.id}__net_interest_margin_nim_annualized__domestic`]?.data.at(-1) ?? null }));
  D.aqLatest = AQL; D.peakIso = PEAK;
  // the extremes of bad loans among all banks with at least ₹10,000 crore lent
  const big = Object.entries(aq.series).filter(([k, s]) => k.endsWith("__gross_advances__domestic") && (s.data.at(-1) ?? 0) >= 10000).map(([k]) => k.replace("__gross_advances__domestic", ""));
  const gn = big.map((id) => ({ id, name: shortName(aq.series[`${id}__gross_advances__domestic`].label.split(", gross advances")[0]), v: aq.series[`${id}__gross_npas_to_gross_advances__domestic`]?.data.at(-1) })).filter((r) => r.v != null).sort((a, b) => b.v - a.v);
  D.npaHigh = gn[0]; D.npaLow = gn.at(-1); D.nBig = gn.length;

  // mergers: deposits in India of the banks that absorbed others (₹ lakh crore)
  D.mergers = [["state_bank_of_india", "SBI", 2017.25], ["hdfc_bank_ltd", "HDFC Bank", 2023.5], ["bank_of_baroda", "Bank of Baroda", 2019.25], ["punjab_national_bank", "Punjab National Bank", 2020.25], ["canara_bank", "Canara Bank", 2020.25], ["union_bank_of_india", "Union Bank of India", 2020.25]]
    .map(([id, name]) => ({ id, name, data: pairs("banks-balance-sheet", `${id}__total_deposits__domestic`).map(([d, v]) => [d, Math.round(v / 1e3) / 100]), note: ser("banks-balance-sheet", `${id}__total_deposits__domestic`).mergerNote }));

  // which loans go bad: bad-loan ratio by sector, all banks
  const SEC = [["agriculture_and_allied_activities_gnpa_ratio", "Agriculture"], ["industry_gnpa_ratio", "Industry"], ["services_gnpa_ratio", "Services"], ["retail_loans_gnpa_ratio", "Retail loans"]];
  D.sector = SEC.map(([k, name]) => ({ k, name, data: pairs("banks-groups-sectoral", `all__${k}__domestic`) }));
  const RET = [["retail_loans_housing_loans", "Home loans"], ["retail_loans_vehicle_auto_loans", "Vehicle loans"], ["retail_loans_credit_card_receivables", "Credit cards"], ["retail_loans_education", "Education loans"], ["other_retail_loans", "Other retail loans"]];
  const SL = lastIso("banks-groups-sectoral");
  D.retail = RET.map(([k, name]) => ({ k, name, ratio: val("banks-groups-sectoral", `all__${k}_gnpa_ratio__domestic`, SL), adv: val("banks-groups-sectoral", `all__${k}_gross_advances__domestic`, SL), peak: Math.max(...pairs("banks-groups-sectoral", `all__${k}_gnpa_ratio__domestic`).map(([, v]) => v)) }));
  D.sectorLatest = SL;
  D.priority = { psl: pairs("banks-groups-priority", "all__priority_sector_gnpa_ratio__domestic"), non: pairs("banks-groups-priority", "all__other_than_priority_gnpa_ratio__domestic"), mse: pairs("banks-groups-priority", "all__priority_mse_gnpa_ratio__domestic") };

  // infrastructure lending, latest quarter, all banks, by top-level sector of the RBI's list
  const IN = load("banks-groups-infra"), IL = IN.dates.at(-1);
  D.infra = Object.entries(IN.series).filter(([k, s]) => k.startsWith("all__") && !s.label.slice(s.label.indexOf(",") + 2).includes(",") && !/all infrastructure/i.test(s.label))
    .map(([k, s]) => ({ name: s.label.split(", ").slice(1).join(", ").replace(/^./, (c) => c.toUpperCase()), v: s.data.at(-1) })).filter((r) => r.v != null).sort((a, b) => b.v - a.v);
  D.infraTotal = IN.series.all__all_infrastructure?.data.at(-1) ?? null; D.infraLatest = IL;

  // branches by population group since 1969 (credit's bundle), and offices by bank group
  const BR = load("credit-deep-branches-population");
  D.branches = Object.entries(BR.series).map(([k, s]) => ({ k, name: s.label, data: BR.dates.map((d, i) => [d, s.data[i]]).filter(([, v]) => v != null) }));
  const OF = load("credit-deep-offices-bank-groups");
  D.offices = Object.entries(OF.series).filter(([k]) => k.endsWith("__branch")).map(([k, s]) => ({ k, name: s.label, v: s.data.at(-1), v0: s.data.find((x) => x != null) })).filter((r) => r.v != null).sort((a, b) => b.v - a.v);
  D.officesLatest = OF.dates.at(-1); D.officesFirst = OF.dates[0];

  // urban co-operative banks
  D.ucbCount = { all: pairs("banks-ucb-structure", "all__ucbs"), scheduled: pairs("banks-ucb-structure", "scheduled__ucbs"), non: pairs("banks-ucb-structure", "non_scheduled__ucbs") };
  D.ucbNpa = { all: pairs("banks-ucb-npa-dbie", "all__gross_npa_ratio"), scheduled: pairs("banks-ucb-npa-dbie", "scheduled__gross_npa_ratio"), non: pairs("banks-ucb-npa-dbie", "non_scheduled__gross_npa_ratio") };
  D.scbMarchNpa = H.dates.map((d, i) => [d, H.series.all_gnpa.data[i]]).filter(([d, v]) => d.endsWith("-03-01") && v != null);
  const US = load("banks-ucb-states"), USL = US.dates.at(-1);
  D.ucbStates = Object.entries(US.series).filter(([k, s]) => k.endsWith("__deposits") && s.state).map(([k, s]) => ({ state: s.stateSlug, name: s.label.replace(/, deposits$/, ""), dep: s.data.at(-1), ucbs: US.series[k.replace("__deposits", "__ucbs")]?.data.at(-1) ?? null, branches: US.series[k.replace("__deposits", "__branches")]?.data.at(-1) ?? null }))
    .filter((r) => r.dep != null).sort((a, b) => b.dep - a.dep);
  D.ucbStatesTotal = US.series.all_india__deposits?.data.at(-1) ?? null; D.ucbStatesLatest = USL;
  const RT = load("banks-ucb-ratings-dbie"), RTL = RT.dates.at(-1);
  D.ucbRatings = Object.entries(RT.series).map(([k, s]) => ({ r: s.label.replace(/^Rating /, "").replace(/, number of UCBs$/, ""), v: s.data.at(-1) })).filter((r) => r.v != null)
    .sort((a, b) => ["A", "B+", "B", "C", "D", "E"].indexOf(a.r) - ["A", "B+", "B", "C", "D", "E"].indexOf(b.r));
  D.ucbRatingsLatest = RTL;
  const CR = load("banks-ucb-crar-dbie");
  D.ucbCrar = Object.entries(CR.series).filter(([k]) => k.endsWith("__all")).map(([k, s]) => ({ band: s.label.split(", ")[0], v: s.data.at(-1) }));
  D.ucbCrarLatest = CR.dates.at(-1);

  // NBFCs (credit's bundle): credit by sector, the latest month
  const NB = load("credit-nbfc"), NBL = NB.dates.at(-1);
  D.nbfc = Object.entries(NB.series).map(([k, s]) => ({ k, name: s.label, v: s.data.at(-1) })).filter((r) => r.v != null);
  D.nbfcLatest = NBL; D.nbfcUnit = NB.meta.unit;

  // development banks: total liabilities (= assets) each March, ₹ lakh crore
  const tot = (slug, re) => { const b = load(slug); const k = Object.keys(b.series).find((x) => re.test(x)); if (!k) throw new Error(`banks.data: no total in ${slug}`); return { key: k, data: pairs(slug, k).map(([d, v]) => [d, Math.round(v / 1e3) / 100]) }; };
  D.fi = [["NABARD", tot("banks-fi-nabard", /^liabilities_total_liabilities$/)], ["SIDBI", tot("banks-fi-sidbi", /^total_liabilities_assets_total_liabilities$/)], ["EXIM Bank", tot("banks-fi-exim", /^total_liabilities_assets$/)], ["NHB", tot("banks-fi-nhb", /^liabilities_total_liabilities_assets$/)]].map(([name, t]) => ({ name, ...t }));
  // deposit insurance: insured and assessable deposits, each March
  const ins = load("banks-fi-insured-deposits");
  D.insured = ins.dates.map((d, i) => [d, ins.series.total_amount_of_insured_deposits.data[i], ins.series.total_amount_of_assessable_deposits.data[i], ins.series.number_of_fully_protected_accounts?.data[i], ins.series.total_number_of_accounts?.data[i]])
    .filter(([, a, b]) => a != null && b != null);
  return D;
}

// ---- the page's figures: id -> HTML, every one from bankData(), formatted by the shared renderers
// (src/charts/format.js, which scripts/qc.mjs also renders through)
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const monthOf = (iso) => `${MONTHS[+iso.slice(5, 7) - 1]} ${iso.slice(0, 4)}`;
const fyOf = (iso) => `${+iso.slice(0, 4) - 1}-${iso.slice(2, 4)}`;
const pc = (u) => `<span class="pc">${u}</span>`;
const crore = (v) => "₹" + fmt.inr(v) + " crore";
const lakhCrore = (v) => fmt.lc1(v / 1e5);

export function bankNumbers(D = bankData()) {
  const N = {};
  const hp = (k) => D.healthDates.map((d, i) => [d, D.health[k][i]]).filter(([, v]) => v != null);
  const lastH = (k) => hp(k).at(-1)?.[1] ?? null;
  const max = (a) => a.reduce((p, c) => (c[1] > p[1] ? c : p)), min = (a) => a.reduce((p, c) => (c[1] < p[1] ? c : p));

  // title block and § 01
  const all = lastH("all_gnpa"), peakAll = max(hp("all_gnpa")), psbShare0 = hp("psb_deposit_share")[0];
  N["m-latest"] = monthOf(D.latest);
  N["u-reading"] = `RBI, bank-wise returns, ${monthOf(D.latest)}`;
  N["n-npa"] = all.toFixed(2) + pc("%");
  N["d-npa"] = `<b>${fmt.pct2(peakAll[1])}</b> at the peak, ${monthOf(peakAll[0])}`;
  N["n-psb"] = lastH("psb_deposit_share").toFixed(1) + pc("%");
  N["d-psb"] = `<b>${fmt.pct1(psbShare0[1])}</b> in ${monthOf(psbShare0[0])}`;
  N["n-crar"] = lastH("all_crar").toFixed(2) + pc("%");
  N["d-crar"] = `public sector <b>${fmt.pct2(lastH("psb_crar"))}</b>, private <b>${fmt.pct2(lastH("private_crar"))}</b>`;
  N["n-roa"] = lastH("all_roa").toFixed(2) + pc("%");
  N["d-roa"] = `public sector <b>${fmt.pct2(lastH("psb_roa"))}</b>, private <b>${fmt.pct2(lastH("private_roa"))}</b>`;
  N["rb-npa"] = all.toFixed(2) + pc("%");
  N["rb-peak"] = fmt.pct2(peakAll[1]);
  N["rb-peakd"] = monthOf(peakAll[0]);

  // § 02 and § 11 deposit insurance
  const [dIns, ins, ass, acc, accAll] = D.insured.at(-1);
  N["lr-ins-acc"] = fmt.pct1((100 * acc) / accAll);
  N["lr-ins-share"] = fmt.pct1((100 * ins) / ass);

  // § 04 bad loans
  const psbPk = max(hp("psb_gnpa"));
  N["pv-npa"] = fmt.pct2(all);
  N["ex-n-all"] = fmt.pct2(all); N["ex-n-psb"] = fmt.pct2(lastH("psb_gnpa")); N["ex-n-pvt"] = fmt.pct2(lastH("private_gnpa")); N["ex-n-for"] = fmt.pct2(lastH("foreign_gnpa")); N["ex-n-sfb"] = fmt.pct2(lastH("sfb_gnpa"));
  N["ex-n-pkd"] = monthOf(peakAll[0]); N["ex-n-pk"] = fmt.pct2(peakAll[1]); N["ex-n-pkpsb"] = fmt.pct2(psbPk[1]); N["ex-n-net"] = fmt.pct2(lastH("all_nnpa"));

  // § 05 shares and the largest banks
  const S = (k) => D.shares[k] ?? [];
  const p = S("psb__deposits"), v = S("private__deposits");
  N["pv-shares"] = fmt.pct1(p.at(-1)[1]);
  N["ex-s-psb"] = fmt.pct1(p.at(-1)[1]); N["ex-s-psb0"] = fmt.pct1(p[0][1]); N["ex-s-d0"] = monthOf(p[0][0]);
  N["ex-s-pvt"] = fmt.pct1(v.at(-1)[1]); N["ex-s-pvt0"] = fmt.pct1(v[0][1]);
  N["ex-s-psba"] = fmt.pct1(S("psb__advances").at(-1)[1]); N["ex-s-pvta"] = fmt.pct1(S("private__advances").at(-1)[1]);
  const big = D.biggest;
  N["pv-biggest"] = fmt.pct1(D.top5share);
  N["ex-b-n"] = fmt.count(D.nBanks); N["ex-b-1"] = big[0].name; N["ex-b-1s"] = fmt.pct1(big[0].share); N["ex-b-5"] = fmt.pct1(D.top5share);
  const h = big.find((r) => r.id === "hdfc_bank_ltd");
  if (h) { N["ex-b-h0"] = fmt.pct1(h.share0); N["ex-b-h"] = fmt.pct1(h.share); }
  N["ex-b-hm"] = fmt.pt1(D.hdfcStep);

  // § 06 profit, capital, margins
  const i = D.profit.years.length - 1;
  const worst = min(D.profit.all.map((x, j) => [D.profit.years[j], x]).filter(([, x]) => x != null));
  N["pv-profit"] = lakhCrore(D.profit.all[i]);
  N["ex-p-fy"] = fyOf(D.profit.years[i]); N["ex-p-all"] = lakhCrore(D.profit.all[i]); N["ex-p-psb"] = lakhCrore(D.profit.psb[i]); N["ex-p-pvt"] = lakhCrore(D.profit.private[i]);
  N["ex-p-wfy"] = fyOf(worst[0]); N["ex-p-w"] = crore(-worst[1]);
  const lo = ["psb", "private", "foreign"].map((g) => min(hp(`${g}_crar`)).concat(g)).reduce((a, b) => (b[1] < a[1] ? b : a));
  N["pv-capital"] = fmt.pct2(lastH("all_crar"));
  N["ex-c-all"] = fmt.pct2(lastH("all_crar")); N["ex-c-psb"] = fmt.pct2(lastH("psb_crar")); N["ex-c-pvt"] = fmt.pct2(lastH("private_crar")); N["ex-c-for"] = fmt.pct2(lastH("foreign_crar"));
  N["ex-c-lo"] = fmt.pct2(lo[1]); N["ex-c-lod"] = `${{ psb: "public sector banks", private: "private sector banks", foreign: "foreign banks" }[lo[2]]}, ${monthOf(lo[0])}`;
  const M = D.margins;
  N["pv-margins"] = fmt.pct2(M.nim.at(-1)[1]);
  N["ex-m-y"] = fmt.pct2(M.yield.at(-1)[1]); N["ex-m-c"] = fmt.pct2(M.cost.at(-1)[1]); N["ex-m-n"] = fmt.pct2(M.nim.at(-1)[1]);
  N["ex-m-d0"] = monthOf(M.yield[0][0]); N["ex-m-y0"] = fmt.pct2(M.yield[0][1]); N["ex-m-c0"] = fmt.pct2(M.cost[0][1]);

  // § 07 bank by bank
  const L = D.lenders.filter((r) => r.now != null);
  const hi = L.reduce((a, b) => (b.now > a.now ? b : a)), lw = L.reduce((a, b) => (b.now < a.now ? b : a));
  N["pv-bank-npa"] = fmt.pct2(hi.now);
  N["ex-bn-hi"] = hi.name; N["ex-bn-hiv"] = fmt.pct2(hi.now); N["ex-bn-lo"] = lw.name; N["ex-bn-lov"] = fmt.pct2(lw.now);
  N["ex-bn-n"] = fmt.count(D.nBig); N["ex-bn-x"] = D.npaHigh.name; N["ex-bn-xv"] = fmt.pct2(D.npaHigh.v);
  const R = D.lenders.filter((r) => r.roa != null).sort((a, b) => b.roa - a.roa), sbi = R.find((r) => r.id === "state_bank_of_india");
  N["pv-bank-roa"] = fmt.pct2(R[0].roa);
  N["ex-r-hi"] = R[0].name; N["ex-r-hiv"] = fmt.pct2(R[0].roa); N["ex-r-lo"] = R.at(-1).name; N["ex-r-lov"] = fmt.pct2(R.at(-1).roa); N["ex-r-sbi"] = sbi ? fmt.pct2(sbi.roa) : "–";
  const mg = (id) => D.mergers.find((m) => m.id === id).data.at(-1)[1];
  N["pv-mergers"] = fmt.lc1(mg("state_bank_of_india"));
  N["ex-mg-sbi"] = fmt.lc1(mg("state_bank_of_india")); N["ex-mg-hdfc"] = fmt.lc1(mg("hdfc_bank_ltd")); N["ex-mg-pnb"] = fmt.lc1(mg("punjab_national_bank"));
  N["ex-mg-can"] = fmt.lc1(mg("canara_bank")); N["ex-mg-bob"] = fmt.lc1(mg("bank_of_baroda")); N["ex-mg-ubi"] = fmt.lc1(mg("union_bank_of_india"));

  // § 08 which loans go bad, infrastructure
  const SE = Object.fromEntries(D.sector.map((s) => [s.name, s.data]));
  const ind = SE.Industry, indPk = max(ind);
  N["pv-sector-npa"] = fmt.pct2(ind.at(-1)[1]);
  N["ex-sn-ind"] = fmt.pct2(ind.at(-1)[1]); N["ex-sn-indpk"] = `${fmt.pct2(indPk[1])}, ${monthOf(indPk[0])}`; N["ex-sn-agr"] = fmt.pct2(SE.Agriculture.at(-1)[1]); N["ex-sn-ser"] = fmt.pct2(SE.Services.at(-1)[1]); N["ex-sn-ret"] = fmt.pct2(SE["Retail loans"].at(-1)[1]);
  N["ex-sn-psl"] = fmt.pct2(D.priority.psl.at(-1)[1]); N["ex-sn-non"] = fmt.pct2(D.priority.non.at(-1)[1]); N["ex-sn-mse"] = fmt.pct2(D.priority.mse.at(-1)[1]);
  const rt = (k) => D.retail.find((r) => r.k === k);
  N["pv-retail-npa"] = fmt.pct2(rt("retail_loans_credit_card_receivables").ratio);
  N["ex-rn-card"] = fmt.pct2(rt("retail_loans_credit_card_receivables").ratio); N["ex-rn-veh"] = fmt.pct2(rt("retail_loans_vehicle_auto_loans").ratio);
  N["ex-rn-edu"] = fmt.pct2(rt("retail_loans_education").ratio); N["ex-rn-edupk"] = fmt.pct2(rt("retail_loans_education").peak); N["ex-rn-home"] = fmt.pct2(rt("retail_loans_housing_loans").ratio);
  N["ex-rn-homeamt"] = lakhCrore(rt("retail_loans_housing_loans").adv);
  const inSh = (re) => { const r = D.infra.find((x) => re.test(x.name)); return r && D.infraTotal ? fmt.pct1((100 * r.v) / D.infraTotal) : "–"; };
  N["pv-infra"] = lakhCrore(D.infraTotal);
  N["ex-i-en"] = inSh(/^Energy/); N["ex-i-tr"] = inSh(/^Transport/); N["ex-i-co"] = inSh(/^Communication/);

  // § 09 branches
  const br = (k) => D.branches.find((b) => b.k === k).data.at(-1)[1];
  const brTot = ["rural", "semi_urban", "urban", "metropolitan"].reduce((a, k) => a + br(k), 0);
  N["pv-branches"] = fmt.inr(br("rural"));
  N["ex-br-r"] = fmt.inr(br("rural")); N["ex-br-s"] = fmt.inr(br("semi_urban")); N["ex-br-u"] = fmt.inr(br("urban")); N["ex-br-m"] = fmt.inr(br("metropolitan"));
  N["ex-br-rs"] = fmt.pct1((100 * (br("rural") + br("semi_urban"))) / brTot);
  const of = (re) => D.offices.find((r) => re.test(r.k));
  N["pv-offices"] = fmt.inr(of(/^public/).v);
  N["ex-of-psb"] = fmt.inr(of(/^public/).v); N["ex-of-psb0"] = fmt.inr(of(/^public/).v0); N["ex-of-d0"] = monthOf(D.officesFirst);
  N["ex-of-pvt"] = fmt.inr(of(/^private/).v); N["ex-of-pvt0"] = fmt.inr(of(/^private/).v0); N["ex-of-rrb"] = fmt.inr(of(/^regional/).v); N["ex-of-sfb"] = fmt.inr(of(/^small/).v);

  // § 10 urban co-operative banks
  const n = D.ucbCount.all.at(-1), n0 = D.ucbCount.all[0];
  N["pv-ucb"] = fmt.inr(n[1]);
  N["ex-u-n"] = fmt.inr(n[1]); N["ex-u-n0"] = fmt.inr(n0[1]); N["ex-u-d0"] = monthOf(n0[0]); N["ex-u-sch"] = fmt.inr(D.ucbCount.scheduled.at(-1)[1]);
  N["ex-u-npa"] = fmt.pct2(D.ucbNpa.all.at(-1)[1]); N["ex-u-scb"] = fmt.pct2(D.scbMarchNpa.at(-1)[1]); N["ex-u-non"] = fmt.pct2(D.ucbNpa.non.at(-1)[1]);
  const us = (s) => D.ucbStates.find((r) => r.state === s), usTot = D.ucbStates.reduce((a, r) => a + r.dep, 0);
  N["pv-ucb-states"] = fmt.pct1((100 * us("maharashtra").dep) / usTot);
  N["ex-us-mh"] = crore(us("maharashtra").dep); N["ex-us-mhn"] = fmt.inr(us("maharashtra").ucbs); N["ex-us-gj"] = crore(us("gujarat").dep); N["ex-us-ka"] = crore(us("karnataka").dep);
  N["ex-us-none"] = fmt.count(D.ucbStates.filter((r) => (r.ucbs ?? 0) <= 1).length);
  const RA = Object.fromEntries(D.ucbRatings.map((r) => [r.r, r.v])), raTot = D.ucbRatings.reduce((a, r) => a + r.v, 0);
  const low = D.ucbCrar.filter((b) => /< ?9|< 3|< 6/.test(b.band) && !/9 <=/.test(b.band)).reduce((a, b) => a + b.v, 0);
  N["pv-ucb-ratings"] = fmt.pct1((100 * ((RA.D ?? 0) + (RA.E ?? 0))) / raTot);
  N["ex-ur-a"] = fmt.inr(RA.A); N["ex-ur-bp"] = fmt.inr(RA["B+"]); N["ex-ur-b"] = fmt.inr(RA.B); N["ex-ur-c"] = fmt.inr(RA.C); N["ex-ur-d"] = fmt.inr(RA.D); N["ex-ur-e"] = fmt.inr(RA.E);
  N["ex-ur-low"] = fmt.inr(low);

  // § 11 NBFCs, development banks, deposit insurance
  const NB = Object.fromEntries(D.nbfc.map((r) => [r.k, r.v]));
  N["pv-nbfc"] = fmt.lc1(NB.nbfc_credit);
  N["ex-nb-ind"] = fmt.lc1(NB.industry); N["ex-nb-inf"] = fmt.lc1(NB.infrastructure); N["ex-nb-ret"] = fmt.lc1(NB.retail_loans); N["ex-nb-ser"] = fmt.lc1(NB.services);
  const fv = (nm) => D.fi.find((f) => f.name === nm).data.at(-1)[1];
  N["pv-fi"] = fmt.lc1(fv("NABARD"));
  N["ex-fi-nab"] = fmt.lc1(fv("NABARD")); N["ex-fi-sid"] = fmt.lc1(fv("SIDBI")); N["ex-fi-exim"] = fmt.lc1(fv("EXIM Bank")); N["ex-fi-nhb"] = fmt.lc1(fv("NHB"));
  N["pv-insured"] = fmt.pct1((100 * ins) / ass);
  N["ex-in-amt"] = lakhCrore(ins); N["ex-in-ass"] = lakhCrore(ass); N["ex-in-sh"] = fmt.pct1((100 * ins) / ass); N["ex-in-acc"] = fmt.pct1((100 * acc) / accAll);
  void dIns;

  // provenance
  N["prov-vintage"] = D.vintage ?? "–"; N["prov-vintage2"] = D.vintage ?? "–";
  return N;
}
