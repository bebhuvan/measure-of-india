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
const RATIO = { data: M2.rural.data.map((d, i) => ({ date: d.date, value: M2.urban.data[i].value / d.value })) };

// rows[8] (optional) overrides the section vintage — the 2024-base prints
// arrive on their own release cycle
const cpiRows = [
  ["Headline CPI · base 2024", "CPI24-ALL", "s-acc", C24.headline, false, "/dossiers/cpi/", null, f1, "12 Jul 2026"],
  ["Food & beverages · base 2024", "CPI24-FB", "s-g1", C24.food_and_beverages, false, "/dossiers/cpi/", null, f1, "12 Jul 2026"],
  ["Headline CPI (combined) · base retired · to Dec 2025", "CPI-ALL", "s-acc", C.headline, false, "/dossiers/cpi/", "computed"],
  ["Food & beverages · base retired · to Dec 2025", "CPI-FB", "s-g1", C.food, false, "/dossiers/cpi/"],
  ["Fuel & light · base retired · to Dec 2025", "CPI-FUEL", "s-g2", C.fuel, false, "/dossiers/cpi/"],
  ["Core · ex food & fuel · base retired · to Dec 2025", "IA-CORE", "s-g3", C.core, true, "/dossiers/cpi/", "derived"],
];
const gdpRows = [
  ["Real GDP", "NAS-GDP", "s-acc", G.gdp, false, "/dossiers/gdp/", "computed"],
  ["Real GVA", "NAS-GVA", "s-g1", G.gva, false, "/dossiers/gdp/"],
  ["Consumption · PFCE", "NAS-PFCE", "s-g2", G.pfce, false, "/dossiers/gdp/", "computed"],
  ["Investment · GFCF", "NAS-GFCF", "s-g3", G.gfcf, false, "/dossiers/gdp/", "computed"],
];
const wpiRows = [
  ["Headline WPI", "WPI-ALL", "s-acc", W.headline, false, "/dossiers/wpi/", "computed"],
  ["Primary articles", "WPI-PRI", "s-g1", W.primary, false, "/dossiers/wpi/"],
  ["Fuel & power", "WPI-FUEL", "s-g2", W.fuel, false, "/dossiers/wpi/"],
  ["Manufactured products", "WPI-MFG", "s-g3", W.manufactured, false, "/dossiers/wpi/"],
  ["Food index", "WPI-FOOD", "s-g4", W.food_index, false, "/dossiers/wpi/"],
];
const iipRows = [
  ["General (headline)", "IIP-GEN", "s-acc", I.general, false, "/dossiers/iip/", "computed"],
  ["Manufacturing", "IIP-MFG", "s-g1", I.sector_manufacturing, false, "/dossiers/iip/"],
  ["Capital goods", "IIP-CAP", "s-g2", I.use_capital_goods, false, "/dossiers/iip/", "computed"],
  ["Consumer non-durables", "IIP-CND", "s-g3", I.use_consumer_non_durables, false, "/dossiers/iip/", "computed"],
];
const extRows = [
  ["Trade balance, goods · $bn/mo", "RBI-TB", "s-acc", TB, false, "/dossiers/external/", "computed", fBn],
  ["Forex reserves · $bn", "RBI-FX", "s-g1", FR, false, "/dossiers/external/", null, fBn],
  ["USD / INR · monthly avg", "RBI-USD", "s-g2", FU, false, "/dossiers/external/", null, fRs],
  ["CAD · % of GDP", "RBI-CAD", "s-g3", RC, false, "/dossiers/external/", null, f1],
  ["Remittances · private transfers, net · $bn/yr", "RBI-REM", "s-acc", REM, false, "/dossiers/external/", null, fBn],
  ["RBI net US$ purchase(+)/sale(−) · $bn/mo", "RBI-INT", "s-g4", IVN, false, "/dossiers/external/", null, fBn2],
  ["Forward premia · 3-month · % p.a.", "RBI-FWP", "s-g1", FWP, false, "/dossiers/external/", null, (v) => v.toFixed(2) + "%"],
  ["EUR / INR · monthly avg", "RBI-EUR", "s-g2", EUR, false, "/dossiers/external/", null, fRs],
  ["Exports to USA · $bn/yr", "RBI-XUS", "s-g3", XUS, false, "/dossiers/external/", null, fBn],
  ["Imports from China · $bn/yr", "RBI-MCN", "s-g4", MCN, false, "/dossiers/external/", null, fBn],
  ["Petroleum, crude & products imports · $bn/yr", "RBI-MPE", "s-g1", MPET, false, "/dossiers/external/", null, fBn],
];
// HCES is two survey rounds: a two-point sparkline is a bare diagonal, so the
// history cell degrades to a note — same choice the dossier's own ledger makes.
const hcesRows = [
  ["MPCE · rural · ₹/person/month", "HCES-MPCE-R", "s-acc", M2.rural, false, "/dossiers/consumption/", null, fInr],
  ["MPCE · urban · ₹/person/month", "HCES-MPCE-U", "s-g1", M2.urban, false, "/dossiers/consumption/", null, fInr],
  ["Urban ÷ rural MPCE", "IA-UR-RATIO", "s-g2", RATIO, true, "/dossiers/consumption/", null, (v) => v.toFixed(2) + "×"],
  ["Consumption Gini · rural", "HCES-GINI-R", "s-g3", G2.rural, false, "/dossiers/consumption/", null, fG],
  ["Consumption Gini · urban", "HCES-GINI-U", "s-g4", G2.urban, false, "/dossiers/consumption/", null, fG],
];
const asiRows = [
  ["Factories in operation · ASI", "ASI-FOP", "s-acc", ASI.factories_in_operation, false, "/dossiers/factories/", null, (v) => Math.round(v).toLocaleString("en-IN")],
  ["Persons engaged · ASI", "ASI-PE", "s-g1", ASI.persons_engaged, false, "/dossiers/factories/", null, fCr],
  ["Factory GVA · ASI · nominal · ₹ lakh cr", "ASI-GVA", "s-g2", ASI.gva, false, "/dossiers/factories/", null, fLcr],
  ["Establishments · unincorporated · ASUSE", "ASUSE-EST", "s-g3", ASU.establishments_all, false, "/dossiers/factories/", null, fCr],
  ["GVA per worker · informal · ASUSE · ₹/yr", "ASUSE-GVW", "s-g4", noNulls(ASU.gva_per_worker_all), false, "/dossiers/factories/", null, fInr],
  // v1.1 additions: the oldest classification block and the informal-firm portrait
  ["Factories on register · NIC-1987 block", "ASI87-NF", "s-g2", ASI87.number_of_factories, false, "/dossiers/factories/", null, (v) => Math.round(v).toLocaleString("en-IN"), "block to 1997-98"],
  ["Establishments using internet · ASUSE", "ASUSE-NET", "s-g1", ASUM.internet_all_combined, false, "/dossiers/factories/", null, (v) => Math.round(v).toLocaleString("en-IN") + " / 1,000"],
];
const plfsRows = [
  ["UR · all-India · monthly CWS", "PLFS-UR", "s-acc", PM.ur, false, "/dossiers/jobs/"],
  ["LFPR · all-India · monthly", "PLFS-LFPR", "s-g1", PM.lfpr, false, "/dossiers/jobs/"],
  ["WPR · all-India · monthly", "PLFS-WPR", "s-g2", PM.wpr, false, "/dossiers/jobs/"],
  ["UR · urban · quarterly CWS", "PLFS-QUR", "s-g3", PQ.ur, false, "/dossiers/jobs/"],
  ["LFPR · urban · quarterly", "PLFS-QLFPR", "s-g4", PQ.lfpr, false, "/dossiers/jobs/"],
  ["UR · annual · usual status PS+SS", "PLFS-AUPS", "s-acc", PA.ur_psss, false, "/dossiers/jobs/"],
  ["UR · annual · weekly CWS", "PLFS-AUCWS", "s-g1", PA.ur_cws, false, "/dossiers/jobs/"],
];

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
      document.getElementById(`${prefix}-${i}`).innerHTML = '<span class="code">two rounds · not charted</span>';
      return;
    }
    const color = getComputedStyle(document.querySelector("." + sw)).backgroundColor;
    const vs = s.data.map((d) => d.value);
    const sp = Plot.plot({
      width: 170, height: 40, marginLeft: 0, marginRight: 0, marginTop: 4, marginBottom: 4,
      style: { background: "transparent" }, x: { axis: null },
      y: { axis: null, domain: [Math.min(...vs, 0), Math.max(...vs)] },
      marks: [
        Plot.ruleY([0], { stroke: "#E6E2D6" }),
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
render("reg-wpi", wpiRows, 12, "spw", "14 May 2026", "OEA / DPIIT");
render("reg-iip", iipRows, 12, "spi", "Jul 2026 · QE");
render("reg-ext", extRows, 12, "spe", "Jun 2025", "RBI");
render("reg-plfs", plfsRows, 12, "spl", "Jun 2026");
render("reg-hces", hcesRows, 1, "sph", "2023-24 round");
render("reg-asi", asiRows, 1, "spa", "2023-24");
