// Manufacturing guide (World Bank WDI): the plates, drawn at build time with the chart kit
// (src/kit/), and the page's numbers, computed from the same bundles. Each plate export returns a
// bare figure for its .plotzone; titles, source lines and buttons stay in
// src/pages/guides/manufacturing.astro. The WDI is calendar-year and revises history freely, so
// every figure comes from the bundles and the vintage is quoted with it. The constant-US$ level
// is shown in billions: a display conversion only, never written to the data.
import * as K from "../kit/kit.js";
import { figure } from "../kit/figure.js";
import { pairs, last, first } from "../kit/data.js";
import { round } from "./precision.js";
import wdi from "../../data/series/wdi-manufacturing.json";
import comp from "../../data/series/wdi-manufacturing-composition.json";
import tech from "../../data/series/wdi-manufacturing-tech.json";
import exp from "../../data/series/wdi-manufacturing-exports.json";

const PCT = { suffix: "%" };
const yr = (d) => d.slice(0, 4);
// shares of MVA and of exports are not in the site's rate-unit list, so they are rounded here,
// once, at the one decimal the page prints
const r1 = (P) => P.map(([d, v]) => [d, round(v, 1)]);
const peak = (P) => P.reduce((a, p) => (p[1] != null && (!a || p[1] > a[1]) ? p : a), null);
const trough = (P) => P.reduce((a, p) => (p[1] != null && (!a || p[1] < a[1]) ? p : a), null);
// the extreme is found on the unrounded series (two years can tie at one decimal), then read
// off the rounded one the chart draws, so the note names the year the prose names
const at = (P, d) => P.find((p) => p[0] === d);
const peakOf = (b, k, P) => at(P, peak(pairs(b, k, { round: false }))[0]);
const troughOf = (b, k, P) => at(P, trough(pairs(b, k, { round: false }))[0]);
const f1 = (v) => v.toFixed(1) + "%";
const fS = (v) => (v < 0 ? "−" : "") + Math.abs(v).toFixed(1) + "%";

/** §03: manufacturing's share of GDP against the wider industry share. */
export function share() {
  const mva = pairs(wdi, "mva_pct_gdp"), ind = pairs(wdi, "industry_pct_gdp");
  const pk = peakOf(wdi, "mva_pct_gdp", mva);
  return figure({
    bare: true, file: "india-atlas_manufacturing_mva-share_1960-2025",
    label: `Manufacturing value added and industry including construction, per cent of GDP, India, 1960 to ${yr(last(mva)[0])}: manufacturing peaked at ${f1(pk[1])} in ${yr(pk[0])} and ends at ${f1(last(mva)[1])}, below its 1960 level`,
    draw: (width) => K.line({
      width, freq: "year", unit: PCT, endDp: 1, hoverDp: 1,
      series: [
        { name: "Industry incl. construction", short: "Industry", data: ind, role: "ctx" },
        { name: "Manufacturing", short: "Manufacturing", data: mva, role: "lead" },
      ],
      events: [{ t: "2020-01-01", label: "COVID-19" }],
      notes: [{ d: pk[0], v: pk[1], text: `${f1(pk[1])}\n${yr(pk[0])}, the peak`, side: "right" }],
    }),
  });
}

/** §04: the level in constant 2015 US$, shown in billions. */
export function level() {
  const P = pairs(wdi, "mva_constant_usd").map(([d, v]) => [d, v == null ? null : Math.round(v / 1e8) / 10]);
  const bn = (v) => "$" + Math.round(v) + " bn";
  return figure({
    bare: true, file: "india-atlas_manufacturing_mva-level-bn_1960-2025",
    label: `Manufacturing value added in constant 2015 US dollars, India, 1960 to ${yr(last(P)[0])}, rising from ${bn(first(P)[1])} to ${bn(last(P)[1])}`,
    data: { cols: ["Year", "MVA, constant 2015 US$ bn"], rows: P.map(([d, v]) => [yr(d), v]) },
    draw: (width) => K.line({
      width, freq: "year", unit: { prefix: "$", suffix: " bn" }, hoverDp: 0, endFormat: bn,
      yDomain: [0, Math.ceil(last(P)[1] / 100) * 100 + 100], // headroom above the latest point for its label
      series: [{ name: "MVA, constant 2015 US$ bn", data: P, role: "lead", area: true }],
    }),
  });
}

/** §05: annual growth, a column a year; the falls in sindoor. */
export function growth() {
  const P = pairs(wdi, "mva_growth").filter(([, v], i, a) => v != null || a.slice(0, i).some((p) => p[1] != null));
  const tr = troughOf(wdi, "mva_growth", P), dip = P.find(([d]) => yr(d) === "2019");
  const events = [{ t: yr(tr[0]), label: `${fS(tr[1])} in ${yr(tr[0])}\nthe deepest fall` }];
  if (dip && dip[0] !== tr[0]) events.push({ t: "2019", label: `${fS(dip[1])}\n2019` });
  return figure({
    bare: true, file: "india-atlas_manufacturing_mva-growth_1961-2025",
    label: `Manufacturing value added, annual growth, India, ${yr(P[0][0])} to ${yr(last(P)[0])}: growth ends at ${f1(last(P)[1])}; the deepest fall is ${fS(tr[1])} in ${yr(tr[0])}`,
    data: { cols: ["Year", "MVA growth, per cent"], rows: P.map(([d, v]) => [yr(d), v]) },
    draw: (width) => K.columns({ width, data: P, unit: PCT, freq: "year", events }),
  });
}

/** §06: the five UNIDO groups' shares of MVA; the long swap between machinery and textiles. */
export function composition() {
  const S = (k) => r1(pairs(comp, k));
  return figure({
    bare: true, file: "india-atlas_manufacturing_unido-composition_1963-2023",
    label: `Composition of manufacturing value added by UNIDO group, India, 1963 to ${yr(last(S("machinery_transport"))[0])}: machinery and transport rises to ${f1(last(S("machinery_transport"))[1])}, textiles and clothing falls to ${f1(last(S("textiles_clothing"))[1])}`,
    draw: (width) => K.line({
      width, freq: "year", unit: PCT, endDp: 1, hoverDp: 1, zero: true,
      series: [
        { name: "Other manufacturing", short: "Other", data: S("other"), role: "ctx2" },
        { name: "Chemicals", short: "Chemicals", data: S("chemicals"), role: "ctx" },
        { name: "Food, beverages & tobacco", short: "Food & tobacco", data: S("food_beverages_tobacco"), role: "ctx" },
        { name: "Textiles & clothing", short: "Textiles & clothing", data: S("textiles_clothing"), role: "comp" },
        { name: "Machinery & transport", short: "Machinery & transport", data: S("machinery_transport"), role: "lead" },
      ],
    }),
  });
}

/** §07: manufactures' share of merchandise exports. */
export function exportShare() {
  const P = r1(pairs(exp, "manufactures_share_of_exports")), pk = peakOf(exp, "manufactures_share_of_exports", P);
  return figure({
    bare: true, file: "india-atlas_manufacturing_manufactures-exports_1962-2024",
    label: `Manufactures' share of merchandise exports, India, 1962 to ${yr(last(P)[0])}: a peak of ${f1(pk[1])} in ${yr(pk[0])}, ${f1(last(P)[1])} in ${yr(last(P)[0])}`,
    draw: (width) => K.line({
      width, freq: "year", unit: PCT, endDp: 1, hoverDp: 1,
      series: [{ name: "Manufactures, share of merchandise exports", data: P, role: "lead" }],
      yDomain: [40, 90], // headroom, so the peak's note sits above the line, clear of the end label
      notes: [{ d: pk[0], v: pk[1], text: `${f1(pk[1])}\n${yr(pk[0])}, the peak`, side: "left" }],
    }),
  });
}

/** §08: the medium- and high-tech share, which stops in 2022. */
export function techShare() {
  const P = r1(pairs(tech, "medhi_tech_share")), pk = peakOf(tech, "medhi_tech_share", P), tr = troughOf(tech, "medhi_tech_share", P), L = last(P);
  return figure({
    bare: true, file: "india-atlas_manufacturing_medhi-tech_1990-2022",
    label: `Medium- and high-technology share of manufacturing value added, India, 1990 to ${yr(L[0])}: a spike to ${f1(pk[1])} in ${yr(pk[0])}, a trough of ${f1(tr[1])} in ${yr(tr[0])}, ${f1(L[1])} in ${yr(L[0])}, where the series stops`,
    draw: (width) => K.line({
      width, freq: "year", unit: PCT, endDp: 1, hoverDp: 1, zero: false, endSub: `${yr(L[0])}, last print`,
      series: [{ name: "Medium- & high-tech share of MVA", data: P, role: "lead" }],
      notes: [
        { d: pk[0], v: pk[1], text: `${f1(pk[1])}\n${yr(pk[0])}, the spike`, side: "right" },
        { d: tr[0], v: tr[1], text: `${f1(tr[1])}\n${yr(tr[0])}, the trough`, below: true },
      ],
    }),
  });
}

/* ---------- the page's numbers, by element id (the text the client used to set) ---------- */
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;");
export function numbers() {
  // the same arithmetic the client did, on unrounded values (toFixed at display)
  const raw = (b, k) => b.dates.map((d, i) => [d, b.series[k].data[i]]).filter(([, v]) => v != null);
  const share = raw(wdi, "mva_pct_gdp"), ind = raw(wdi, "industry_pct_gdp"), lvl = raw(wdi, "mva_constant_usd"), gr = raw(wdi, "mva_growth");
  const te = raw(tech, "medhi_tech_share"), ex = raw(exp, "manufactures_share_of_exports");
  const C = (k) => raw(comp, k);
  const pc = (u) => `<span class="pc">${u}</span>`;
  const big = (v) => f1(v).replace("%", pc("%"));
  const bn = (v) => "$" + Math.round(v / 1e9) + " bn";
  const pt = (d) => (d >= 0 ? "▲ +" : "▼ −") + Math.abs(d).toFixed(1) + " pt";
  const sL = share.at(-1), sF = share[0], sPk = peak(share), sTr = trough(share);
  const lL = lvl.at(-1), lF = lvl[0], gL = gr.at(-1), gP = gr.at(-2), gPk = peak(gr), gTr = trough(gr);
  const tL = te.at(-1), tP = te.at(-2), tF = te[0], tPk = peak(te), tTr = trough(te);
  const xL = ex.at(-1), xP = ex.at(-2), xF = ex[0], xPk = peak(ex);
  const vint = esc(wdi.meta.vintage);
  const N = {
    "meta-vintage": vint,
    "n-share": big(sL[1]),
    "d-share": `<b>${pt(sL[1] - sF[1])}</b> vs 1960, peak ${f1(sPk[1])} (${yr(sPk[0])})`,
    "n-level": bn(lL[1]),
    "d-level": `<b>▲ ×${(lL[1] / lF[1]).toFixed(1)}</b> since 1960 (${bn(lF[1])})`,
    "n-growth": big(gL[1]),
    "d-growth": `<b>${pt(gL[1] - gP[1])}</b> vs ${yr(gP[0])}`,
    "n-tech": big(tL[1]),
    "d-tech": `<b>${pt(tL[1] - tP[1])}</b> vs ${yr(tP[0])}, series ends ${yr(tL[0])} (UNIDO lag)`,
    "nspark-share": K.spark(share, { width: 190, height: 44 }),
    "cr-share": big(sL[1]),
    "rb-peak": big(sPk[1]),
    "cr-share2": f1(sL[1]),
    "cr-share-2024": f1(share.at(-2)[1]),
    "cr-industry": f1(ind.at(-1)[1]),
    "cr-level": bn(lL[1]),
    "cr-level-1960": bn(lF[1]),
    "cr-growth": f1(gL[1]),
    "cr-growth-2024": f1(gP[1]),
    "cr-exports": f1(xL[1]),
    "cr-mach": f1(C("machinery_transport").at(-1)[1]),
    "cr-tex": f1(C("textiles_clothing").at(-1)[1]),
    "cr-tech": f1(tL[1]),
    // plate 1
    "pv-share": big(sL[1]),
    "ex-share-peak": f1(sPk[1]),
    "ex-share-low": f1(sTr[1]),
    "ex-share-now": f1(sL[1]),
    "ex-share-ind": f1(ind.at(-1)[1]),
    "ex-share-1960": f1(sF[1]),
    "src-vintage-share": vint,
    // plate 2
    "pv-level": bn(lL[1]),
    "ex-level-first": bn(lF[1]),
    "ex-level-now": bn(lL[1]),
    "ex-level-mult": (lL[1] / lF[1]).toFixed(1) + "-fold",
    "src-vintage-level": vint,
    // plate 3
    "pv-growth": big(gL[1]),
    "ex-growth-trough": fS(gTr[1]) + " in " + yr(gTr[0]),
    "ex-growth-peak": "+" + f1(gPk[1]),
    "ex-growth-whipsaw": [2019, 2020, 2021, 2022, 2023].map((y) => {
      const p = gr.find(([d]) => yr(d) === String(y));
      return (p[1] < 0 ? "−" : "+") + Math.abs(p[1]).toFixed(1);
    }).join(" → "),
    "ex-growth-latest": f1(gL[1]),
    "src-vintage-growth": vint,
    // plate 4
    "pv-composition": big(C("machinery_transport").at(-1)[1]),
    "ex-comp-tex0": f1(C("textiles_clothing")[0][1]),
    "ex-comp-tex": f1(C("textiles_clothing").at(-1)[1]),
    "ex-comp-mach0": f1(C("machinery_transport")[0][1]),
    "ex-comp-mach": f1(C("machinery_transport").at(-1)[1]),
    "ex-comp-chem-peak": f1(peak(C("chemicals"))[1]),
    "ex-comp-mach2": f1(C("machinery_transport").at(-1)[1]),
    "ex-comp-chem": f1(C("chemicals").at(-1)[1]),
    "ex-comp-food": f1(C("food_beverages_tobacco").at(-1)[1]),
    "ex-comp-tex2": f1(C("textiles_clothing").at(-1)[1]),
    "ex-comp-other": f1(C("other").at(-1)[1]),
    "src-vintage-composition": esc(comp.meta.vintage),
    // plate 5
    "pv-exports": big(xL[1]),
    "ex-exp-first": f1(xF[1]),
    "ex-exp-peak": f1(xPk[1]),
    "ex-exp-now": f1(xL[1]),
    "ex-exp-prev": f1(xP[1]),
    "src-vintage-exports": esc(exp.meta.vintage),
    // plate 6
    "pv-tech": big(tL[1]),
    "ex-tech-first": f1(tF[1]),
    "ex-tech-peak": f1(tPk[1]),
    "ex-tech-trough": f1(tTr[1]),
    "ex-tech-now": f1(tL[1]),
    "ex-tech-prev": f1(tP[1]),
    "src-vintage-tech": esc(tech.meta.vintage),
    "prov-vintage": vint,
    "prov-vintage2": vint,
  };
  // § 02 register: latest, year ago and first print per series, a spark of the whole run
  const reg = [
    [share, "Manufacturing value added, share of GDP", "WDI, ISIC C, national accounts", "s-acc", f1],
    [ind, "Industry incl. construction, share of GDP", "WDI, adds mining, utilities, construction", "s-g1", f1],
    [lvl, "Manufacturing value added, constant 2015 US$", "WDI, volumes at the 2015 exchange rate", "s-g2", bn],
    [gr, "Manufacturing value added, annual growth", "WDI, real, y/y", "s-g3", fS],
    [C("machinery_transport"), "Machinery & transport, share of MVA", "UNIDO, technology decomposition", "s-acc", f1],
    [C("chemicals"), "Chemicals, share of MVA", "UNIDO, technology decomposition", "s-g1", f1],
    [C("food_beverages_tobacco"), "Food, beverages & tobacco, share of MVA", "UNIDO, technology decomposition", "s-g2", f1],
    [C("textiles_clothing"), "Textiles & clothing, share of MVA", "UNIDO, technology decomposition", "s-g3", f1],
    [C("other"), "Other manufacturing, share of MVA", "UNIDO, the residual block", "s-g4", f1],
    [te, "Medium- & high-tech, share of MVA", "UNIDO, ends 2022", "s-acc", f1],
    [ex, "Manufactures, share of merchandise exports", "UN Comtrade, SITC 5–8, ends 2024", "s-acc", f1],
  ];
  N["reg-manufacturing"] = reg.map(([d, nm, sub, sw, f]) => {
    const l = d.at(-1), p = d.at(-2), f0 = d[0];
    return `<tr><td class="name"><span class="sw ${sw}"></span>${esc(nm)}<small>${esc(sub)}</small></td>` +
      `<td class="val">${f(l[1])}, ${yr(l[0])}</td>` +
      `<td class="chg">${p ? f(p[1]) + " · " + yr(p[0]) : "—"}</td>` +
      `<td class="yr">${f(f0[1])}, ${yr(f0[0])}</td>` +
      `<td class="spark">${K.spark(d, { width: 190, height: 44 })}</td></tr>`;
  }).join("");
  return N;
}
