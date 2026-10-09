// Register — cross-dossier series ledger with sparklines.
// Same baked bundles as the dossiers.

import * as Plot from "@observablehq/plot";
import cpiBundle from "../../data/series/cpi.json";
import cpi2024Bundle from "../../data/series/cpi-2024.json";
import gdpBundle from "../../data/series/gdp.json";
import wpiBundle from "../../data/series/wpi.json";
import iipBundle from "../../data/series/iip-2022.json";
import tradeBundle from "../../data/series/rbi-trade.json";
import forexBundle from "../../data/series/rbi-forex.json";
import ratiosBundle from "../../data/series/rbi-bop-ratios.json";
import plfsMonthlyBundle from "../../data/series/plfs-monthly.json";
import plfsQuarterlyBundle from "../../data/series/plfs-quarterly.json";
import plfsAnnualBundle from "../../data/series/plfs-annual.json";
import invisiblesBundle from "../../data/series/rbi-invisibles.json";
import interventionBundle from "../../data/series/rbi-intervention.json";
import premiaBundle from "../../data/series/rbi-forward-premia.json";
import ratesBundle from "../../data/series/rbi-exchange-rates.json";
import partnersBundle from "../../data/series/rbi-trade-partners.json";
import commImpBundle from "../../data/series/rbi-commodities-imports.json";
import mpceBundle from "../../data/series/hces-mpce.json";
import giniBundle from "../../data/series/hces-gini.json";
import asiBundle from "../../data/series/asi-headline.json";
import asi1987Bundle from "../../data/series/asi-headline-1987.json";
import asuseBundle from "../../data/series/asuse-annual.json";
import asuseModernityBundle from "../../data/series/asuse-modernity.json";
import aisheHeadlineBundle from "../../data/series/aishe-headline.json";
import genderSexratioBundle from "../../data/series/gender-sexratio.json";
import genderMmrBundle from "../../data/series/gender-mmr.json";
import genderLiteracyBundle from "../../data/series/gender-literacy.json";
import genderWorkBundle from "../../data/series/gender-work.json";
import mnreSourcesBundle from "../../data/series/mnre-sources.json";
import mnreSolarBundle from "../../data/series/mnre-solar-categories.json";
import { hydrate } from "../charts/plumbing.js";

const C = hydrate(cpiBundle);
const C24 = hydrate(cpi2024Bundle);   // base 2024=100 — separate series, never spliced
const G = hydrate(gdpBundle);
const W = hydrate(wpiBundle);
const I = hydrate(iipBundle);
const PM = hydrate(plfsMonthlyBundle);
const PQ = hydrate(plfsQuarterlyBundle);
const PA = hydrate(plfsAnnualBundle);
const f1 = (v) => v.toFixed(2) + "%";
// RBI bundles arrive in US$ millions; the register shows $ billions
const toBn = (s) => ({ ...s, data: s.data.map((d) => ({ ...d, value: d.value == null ? null : d.value / 1000 })) });
const TB = toBn(hydrate(tradeBundle).balance);
const FR = toBn(hydrate(forexBundle).reserves);
const FU = hydrate(forexBundle).usdinr;
const RC = hydrate(ratiosBundle).cad_gdp;
const fBn = (v) => "$" + v.toFixed(1) + " bn";
const fRs = (v) => "₹" + v.toFixed(2);
// intervention months with no reported operations are blank in the source;
// the spark and the year-ago lookup both skip them
const noNulls = (s) => ({ ...s, data: s.data.filter((d) => d.value != null) });
const REM = toBn(noNulls(hydrate(invisiblesBundle).private_transfers));
const IVN = toBn(noNulls(hydrate(interventionBundle).net));
const FWP = noNulls(hydrate(premiaBundle).m3);
const EUR = noNulls(hydrate(ratesBundle).euro);
const XUS = toBn(hydrate(partnersBundle).exports_usa);
const MCN = toBn(hydrate(partnersBundle).imports_china);
const MPET = toBn(hydrate(commImpBundle).petroleum_crude_products);
const fBn2 = (v) => (v < 0 ? "−$" : "$") + Math.abs(v).toFixed(1) + " bn";
// HCES & enterprises formats
const grpIN = (v) => Math.round(v).toLocaleString("en-IN");
const fInr = (v) => "₹" + grpIN(v);
const fG = (v) => v.toFixed(3);
const fCr = (v) => (v / 1e7).toFixed(2) + " crore";
const fLcr = (v) => "₹" + (v / 1e7).toFixed(1) + " lakh cr"; // ₹ lakh -> ₹ lakh crore
const M2 = hydrate(mpceBundle);
const G2 = hydrate(giniBundle);
const ASI = hydrate(asiBundle);
const ASI87 = hydrate(asi1987Bundle);
const ASU = hydrate(asuseBundle);
const ASUM = hydrate(asuseModernityBundle);
const AIH = hydrate(aisheHeadlineBundle);
const GSR = hydrate(genderSexratioBundle);
const GMM = hydrate(genderMmrBundle);
const GLIT = hydrate(genderLiteracyBundle);
const GWK = hydrate(genderWorkBundle);
const MNRE = hydrate(mnreSourcesBundle);
const MNRE_RT = hydrate(mnreSolarBundle);
const RATIO = { data: M2.rural.data.map((d, i) => ({ date: d.date, value: M2.urban.data[i].value / d.value })) };

// rows[8] (optional) overrides the section vintage — the 2024-base prints
// arrive on their own release cycle
const cpiRows = [
  ["Headline CPI, base 2024", "CPI24-ALL", "s-acc", C24.headline, false, "/guides/cpi/", null, f1, "12 Jul 2026"],
  ["Food & beverages, base 2024", "CPI24-FB", "s-g1", C24.food_and_beverages, false, "/guides/cpi/", null, f1, "12 Jul 2026"],
  ["Headline CPI (combined), base retired, to Dec 2025", "CPI-ALL", "s-acc", C.headline, false, "/guides/cpi/", "computed"],
  ["Food & beverages, base retired, to Dec 2025", "CPI-FB", "s-g1", C.food, false, "/guides/cpi/"],
  ["Fuel & light, base retired, to Dec 2025", "CPI-FUEL", "s-g2", C.fuel, false, "/guides/cpi/"],
  ["Core, ex food & fuel, base retired, to Dec 2025", "IA-CORE", "s-g3", C.core, true, "/guides/cpi/", "derived"],
];
const gdpRows = [
  ["Real GDP", "NAS-GDP", "s-acc", G.gdp, false, "/guides/gdp/", "computed"],
  ["Real GVA", "NAS-GVA", "s-g1", G.gva, false, "/guides/gdp/"],
  ["Consumption, PFCE", "NAS-PFCE", "s-g2", G.pfce, false, "/guides/gdp/", "computed"],
  ["Investment, GFCF", "NAS-GFCF", "s-g3", G.gfcf, false, "/guides/gdp/", "computed"],
];
const wpiRows = [
  ["Headline WPI", "WPI-ALL", "s-acc", W.headline, false, "/guides/wpi/", "computed"],
  ["Primary articles", "WPI-PRI", "s-g1", W.primary, false, "/guides/wpi/"],
  ["Fuel & power", "WPI-FUEL", "s-g2", W.fuel, false, "/guides/wpi/"],
  ["Manufactured products", "WPI-MFG", "s-g3", W.manufactured, false, "/guides/wpi/"],
  ["Food index", "WPI-FOOD", "s-g4", W.food_index, false, "/guides/wpi/"],
];
const iipRows = [
  ["General (headline)", "IIP-GEN", "s-acc", I.general, false, "/guides/iip/", "computed"],
  ["Manufacturing", "IIP-MFG", "s-g1", I.sector_manufacturing, false, "/guides/iip/"],
  ["Capital goods", "IIP-CAP", "s-g2", I.use_capital_goods, false, "/guides/iip/", "computed"],
  ["Consumer non-durables", "IIP-CND", "s-g3", I.use_consumer_non_durables, false, "/guides/iip/", "computed"],
];
const extRows = [
  ["Trade balance, goods, $bn/mo", "RBI-TB", "s-acc", TB, false, "/guides/external/", "computed", fBn],
  ["Forex reserves, $bn", "RBI-FX", "s-g1", FR, false, "/guides/external/", null, fBn],
  ["USD / INR, monthly avg", "RBI-USD", "s-g2", FU, false, "/guides/external/", null, fRs],
  ["CAD, % of GDP", "RBI-CAD", "s-g3", RC, false, "/guides/external/", null, f1],
  ["Remittances, private transfers, net, $bn/yr", "RBI-REM", "s-acc", REM, false, "/guides/external/", null, fBn],
  ["RBI net US$ purchase(+)/sale(−), $bn/mo", "RBI-INT", "s-g4", IVN, false, "/guides/external/", null, fBn2],
  ["Forward premia, 3-month, % p.a.", "RBI-FWP", "s-g1", FWP, false, "/guides/external/", null, (v) => v.toFixed(2) + "%"],
  ["EUR / INR, monthly avg", "RBI-EUR", "s-g2", EUR, false, "/guides/external/", null, fRs],
  ["Exports to USA, $bn/yr", "RBI-XUS", "s-g3", XUS, false, "/guides/external/", null, fBn],
  ["Imports from China, $bn/yr", "RBI-MCN", "s-g4", MCN, false, "/guides/external/", null, fBn],
  ["Petroleum, crude & products imports, $bn/yr", "RBI-MPE", "s-g1", MPET, false, "/guides/external/", null, fBn],
];
// HCES is two survey rounds: a two-point sparkline is a bare diagonal, so the
// history cell degrades to a note — same choice the dossier's own ledger makes.
const hcesRows = [
  ["MPCE, rural, ₹/person/month", "HCES-MPCE-R", "s-acc", M2.rural, false, "/guides/consumption/", null, fInr],
  ["MPCE, urban, ₹/person/month", "HCES-MPCE-U", "s-g1", M2.urban, false, "/guides/consumption/", null, fInr],
  ["Urban ÷ rural MPCE", "IA-UR-RATIO", "s-g2", RATIO, true, "/guides/consumption/", null, (v) => v.toFixed(2) + "×"],
  ["Consumption Gini, rural", "HCES-GINI-R", "s-g3", G2.rural, false, "/guides/consumption/", null, fG],
  ["Consumption Gini, urban", "HCES-GINI-U", "s-g4", G2.urban, false, "/guides/consumption/", null, fG],
];
const asiRows = [
  ["Factories in operation, ASI", "ASI-FOP", "s-acc", ASI.factories_in_operation, false, "/guides/factories/", null, (v) => Math.round(v).toLocaleString("en-IN")],
  ["Persons engaged, ASI", "ASI-PE", "s-g1", ASI.persons_engaged, false, "/guides/factories/", null, fCr],
  ["Factory GVA, ASI, nominal, ₹ lakh cr", "ASI-GVA", "s-g2", ASI.gva, false, "/guides/factories/", null, fLcr],
  ["Establishments, unincorporated, ASUSE", "ASUSE-EST", "s-g3", ASU.establishments_all, false, "/guides/factories/", null, fCr],
  ["GVA per worker, informal, ASUSE, ₹/yr", "ASUSE-GVW", "s-g4", noNulls(ASU.gva_per_worker_all), false, "/guides/factories/", null, fInr],
  // v1.1 additions: the oldest classification block and the informal-firm portrait
  ["Factories on register, NIC-1987 block", "ASI87-NF", "s-g2", ASI87.number_of_factories, false, "/guides/factories/", null, (v) => Math.round(v).toLocaleString("en-IN"), "block to 1997-98"],
  ["Establishments using internet, ASUSE", "ASUSE-NET", "s-g1", ASUM.internet_all_combined, false, "/guides/factories/", null, (v) => Math.round(v).toLocaleString("en-IN") + " / 1,000"],
];
const aisheRows = [
  ["Student enrolment, AISHE", "AISHE-ENR", "s-acc", AIH.enrolment, false, "/guides/aishe/", null, fCr],
  ["Universities, AISHE", "AISHE-UNI", "s-g1", AIH.universities, false, "/guides/aishe/", null, (v) => Math.round(v).toLocaleString("en-IN")],
  ["Colleges, AISHE", "AISHE-COL", "s-g2", AIH.colleges, false, "/guides/aishe/", null, (v) => Math.round(v).toLocaleString("en-IN")],
  ["Teachers, AISHE, 2021-22 reconstructed", "AISHE-TEA", "s-g3", AIH.teachers, false, "/guides/aishe/", null, fCr],
  ["Gross Enrolment Ratio, All Categories", "AISHE-GER", "s-g4", AIH.ger, false, "/guides/aishe/", null, (v) => v.toFixed(1) + "%"],
  ["Gender Parity Index, All Categories", "AISHE-GPI", "s-acc", AIH.gpi, false, "/guides/aishe/", null, (v) => v.toFixed(2)],
  ["Pupil-Teacher Ratio, all institutions", "AISHE-PTR", "s-g1", AIH.ptr, false, "/guides/aishe/", null, (v) => String(Math.round(v))],
];
const plfsRows = [
  ["UR, all-India, monthly CWS", "PLFS-UR", "s-acc", PM.ur, false, "/guides/jobs/"],
  ["LFPR, all-India, monthly", "PLFS-LFPR", "s-g1", PM.lfpr, false, "/guides/jobs/"],
  ["WPR, all-India, monthly", "PLFS-WPR", "s-g2", PM.wpr, false, "/guides/jobs/"],
  ["UR, urban, quarterly CWS", "PLFS-QUR", "s-g3", PQ.ur, false, "/guides/jobs/"],
  ["LFPR, urban, quarterly", "PLFS-QLFPR", "s-g4", PQ.lfpr, false, "/guides/jobs/"],
  ["UR, annual, usual status PS+SS", "PLFS-AUPS", "s-acc", PA.ur_psss, false, "/guides/jobs/"],
  ["UR, annual, weekly CWS", "PLFS-AUCWS", "s-g1", PA.ur_cws, false, "/guides/jobs/"],
];

// Live tables take their vintage label from the bundle (same derivation as
// display.js's "release" style: the source's release date when known, else
// the data vintage) — a hand-typed date here rots at the next print. The
// frozen retired-ruler tables (cpi's 2012 base, gdp's 2011-12 base) keep
// hand-typed dates on purpose: their final release never changes, and
// gdp.json carries no releaseDate to derive from.
const VT_MS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const vintOf = (b) => {
  const iso = b.meta.releaseDate ?? b.meta.vintage;
  return `${Number(iso.slice(8, 10))} ${VT_MS[Number(iso.slice(5, 7)) - 1]} ${iso.slice(0, 4)}`;
};

function render(tbody, rows, lag, prefix, vintage, srcName = "MoSPI / NSO") {
  document.getElementById(tbody).innerHTML = rows.map(([nm, code, sw, s, derived, href, note, fmt, vt], i) => {
    const f = fmt ?? f1;
    const data = s.data.filter((d) => d.value != null);
    // year-ago = the observation nearest 365 days back, whatever the cadence;
    // a series younger than a year has no year-ago — dash, never the nearest
    // unrelated month (the 2024-base CPI is six months old)
    const target = data.at(-1).date.getTime() - 365.25 * 86400000;
    let yi = 0, best = Infinity;
    data.forEach((d, j) => { const diff = Math.abs(d.date.getTime() - target); if (diff < best) { best = diff; yi = j; } });
    const yrAgo = best <= 60 * 86400000 ? data[yi] : null;
    return `
    <tr>
      <td class="name"><span class="sw ${sw}"></span><a href="${href}">${nm}</a>${derived ? '<span class="derived-tag">Derived</span>' : ""}<small>Source: ${code.startsWith("IA") ? "India Atlas computation" : note === "computed" ? srcName + " · computed from levels" : srcName}</small></td>
      <td class="code">${code}</td>
      <td class="val">${f(data.at(-1).value)}</td>
      <td class="code">${yrAgo == null ? "—" : f(yrAgo.value)}</td>
      <td class="vt">${vt ?? vintage}</td>
      <td class="spark" id="${prefix}-${i}"></td>
    </tr>`;
  }).join("");
  rows.forEach(([nm, code, sw, s], i) => {
    // a series of one or two observations has no shape to draw — degrade to a note
    if (s.data.filter((d) => d.value != null).length < 3) {
      document.getElementById(`${prefix}-${i}`).innerHTML = '<span class="code">two rounds, not charted</span>';
      return;
    }
    const color = getComputedStyle(document.querySelector("." + sw)).backgroundColor;
    const vs = s.data.map((d) => d.value);
    const sp = Plot.plot({
      width: 170, height: 40, marginLeft: 0, marginRight: 0, marginTop: 4, marginBottom: 4,
      style: { background: "transparent" }, x: { axis: null },
      y: { axis: null, domain: [Math.min(...vs, 0), Math.max(...vs)] },
      marks: [
        Plot.ruleY([0], { stroke: "#ECEEF2" }),
        Plot.lineY(s.data, { x: "date", y: "value", stroke: color, strokeWidth: 1.5, strokeLinejoin: "round" }),
        Plot.dot([s.data.at(-1)], { x: "date", y: "value", fill: color, r: 2.5, stroke: "#FFFFFF", strokeWidth: 1 }),
      ],
    });
    sp.setAttribute("aria-hidden", "true");
    document.getElementById(`${prefix}-${i}`).append(sp);
  });
}
render("reg-cpi", cpiRows, 12, "spc", "12 Jan 2026");
render("reg-gdp", gdpRows, 4, "spg", "28 Nov 2025");
render("reg-wpi", wpiRows, 12, "spw", vintOf(wpiBundle), "OEA / DPIIT");
render("reg-iip", iipRows, 12, "spi", "Jul 2026, QE");
render("reg-ext", extRows, 12, "spe", "Jun 2025", "RBI");
render("reg-plfs", plfsRows, 12, "spl", "Jun 2026");
render("reg-hces", hcesRows, 1, "sph", "2023-24 round");
render("reg-asi", asiRows, 1, "spa", "2023-24");
render("reg-aishe", aisheRows, 12, "spai", "2021-22 round", "Ministry of Education");
const genderRows = [
  ["Sex ratio, census, ♀ per 1000 ♂", "GEND-SR", "s-acc", GSR.sex_ratio, false, "/guides/gender/", null, (v) => String(Math.round(v))],
  ["Maternal Mortality Ratio, per 100k", "GEND-MMR", "s-g1", GMM.mmr, false, "/guides/gender/", null, (v) => String(Math.round(v))],
  ["Literacy, female, age 7+, %", "GEND-LITF", "s-g2", GLIT.literacy_female, false, "/guides/gender/", null, (v) => v.toFixed(1) + "%"],
  ["LFPR, female, 15+, %", "GEND-LFPRF", "s-g3", GWK.lfpr_female, false, "/guides/gender/", null, (v) => v.toFixed(1) + "%"],
  ["LFPR, male, 15+, %", "GEND-LFPRM", "s-g4", GWK.lfpr_male, false, "/guides/gender/", null, (v) => v.toFixed(1) + "%"],
];
render("reg-gender", genderRows, 12, "spgd", "multi-source", "MoSPI compendium");
const mnreRows = [
  ["Grand Total, installed, GW", "MNRE-TOT", "s-acc", MNRE.grand_total, false, "/guides/mnre/", null, (v) => (v / 1000).toFixed(1) + " GW"],
  ["Solar, installed, GW", "MNRE-SOL", "s-g1", MNRE.solar, false, "/guides/mnre/", null, (v) => (v / 1000).toFixed(1) + " GW"],
  ["Wind, installed, GW", "MNRE-WND", "s-g2", MNRE.wind, false, "/guides/mnre/", null, (v) => (v / 1000).toFixed(1) + " GW"],
  ["Rooftop solar, installed, GW", "MNRE-RT", "s-g3", MNRE_RT.rooftop, false, "/guides/mnre/", null, (v) => (v / 1000).toFixed(1) + " GW"],
];
render("reg-mnre", mnreRows, 1, "spmn", "Jun 2026", "MNRE");
// NFHS — 2-point, cross-sectional; the register's year-ago logic needs no change
// (it finds the nearest observation ~365 days back, which is the NFHS-4 point)
// Bank deposits, RBI BSR-2: annual, as on 31 March, ₹ lakh crore
import depositsBundle from "../../data/series/deposits-owners.json";
{
  const DP = hydrate(depositsBundle);
  const lc = (v) => "₹" + v.toFixed(1) + " lakh cr";
  render("reg-deposits", [
    ["Household deposits, all types", "BSR2-HH", "s-acc", DP.household_total, false, "/guides/deposits/", null, lc],
    ["Household fixed (term) deposits", "BSR2-HHT", "s-g1", DP.household_term, false, "/guides/deposits/", null, lc],
    ["Household savings accounts", "BSR2-HHS", "s-g2", DP.household_savings, false, "/guides/deposits/", null, lc],
    ["Women's deposits", "BSR2-F", "s-g3", DP.female_total, false, "/guides/deposits/", null, lc],
  ], 1, "spdp", "Mar 2026", "RBI BSR-2");
}
import nfhsAnaemiaBundle from "../../data/series/nfhs-anaemia.json";
import nfhsChildBundle from "../../data/series/nfhs-child.json";
import nfhsFertilityBundle from "../../data/series/nfhs-fertility.json";
const NA = hydrate(nfhsAnaemiaBundle);
const NC = hydrate(nfhsChildBundle);
const NF = hydrate(nfhsFertilityBundle);
const nfhsFind = (b, needle) => { const lower = needle.toLowerCase(); return Object.values(b).find((s) => s.label && s.label.toLowerCase().includes(lower)); };
const nfhsRows = [
  ["Child anaemia (6-59 mo), %", "NFHS-ANM", "s-acc", nfhsFind(NA, "children age 6-59")],
  ["Infant mortality, /1,000", "NFHS-IMR", "s-g1", nfhsFind(NC, "infant mortality")],
  ["Stunting (under-5), %", "NFHS-STN", "s-g2", nfhsFind(NC, "stunted")],
  ["TFR, children/woman", "NFHS-TFR", "s-g3", nfhsFind(NF, "total fertility rate")],
  ["Women's bank account, %", "NFHS-BNK", "s-g4", nfhsFind(NF, "bank or savings")],
].filter(([, , , s]) => s != null);
render("reg-nfhs", nfhsRows.map(([nm, code, sw, s]) => [nm, code, sw, s, false, "/guides/nfhs/"]), 48, "spnf", "NFHS-5", "MoSPI / IIPS");
// --- trade (lb/trade): merchandise trade, TradeStat (DGCI&S), monthly, US$ million -> $ bn ---
import tradeTotalBundle from "../../data/series/trade-total.json";
{
  const TT = hydrate(tradeTotalBundle);
  const bn = (v) => (v < 0 ? "−$" : "$") + Math.abs(v / 1000).toFixed(1) + " bn";
  const m = tradeTotalBundle.dates.at(-1);
  const lbl = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][+m.slice(5, 7) - 1] + " " + m.slice(0, 4);
  render("reg-trade", [
    ["Merchandise exports", "TS-EXP", "s-acc", TT.exports, false, "/guides/trade/", null, bn],
    ["Merchandise imports", "TS-IMP", "s-g1", TT.imports, false, "/guides/trade/", null, bn],
    ["Trade balance", "TS-BAL", "s-g2", TT.balance, false, "/guides/trade/", null, bn],
  ], 12, "sptr", lbl, "TradeStat (DGCI&S)");
}
// --- end trade ---
