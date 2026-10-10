// src/dossiers/banks.data.js: build-time reader for the banks guide (src/pages/guides/banks.astro).
// The bank-by-bank bundles run to several megabytes (every bank, every item, three operations,
// fifty quarters), far past the page budget (docs/CONTRACT-render.md). The page reads them here
// at build time and embeds only what its plates draw, as one inline JSON block that
// src/dossiers/banks.client.js reads. No runtime fetch; every value is a bundle's own, or a
// share computed from two of them (and said so on the plate).
import fs from "node:fs";
import path from "node:path";

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
