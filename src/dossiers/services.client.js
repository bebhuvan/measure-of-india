// The services guide: plates and number wiring.
// Data (all baked at build, nothing fetched for the charts):
//   services-gva-2022-*  NAS, 2022-23 base: share of GVA, real growth, level (annual)
//   services-gva-2011-*  NAS, 2011-12 base: the same, a separate ruler, never joined
//   gdp-2022-industries  the GDP guide's quarterly real growth by industry group (read only)
//   services-isp-*       the trial Index of Services Production: monthly y/y and the 2025-26 year
//   services-trade-monthly, services-bop-quarterly, services-invisibles-quarterly, services-bop-annual
//                        RBI DBIE: monthly totals, BPM6 categories, purpose codes, 1950-51 on
//   services-jobs-*      PLFS: share of workers by industry (calendar years; agriculture years)
//   services-asuse*      ASUSE: unincorporated service enterprises by activity

import * as Plot from "@observablehq/plot";
import share22_raw from "../../data/series/services-gva-2022-share.json";
import growth22_raw from "../../data/series/services-gva-2022-growth.json";
import level22_raw from "../../data/series/services-gva-2022-level.json";
import share11_raw from "../../data/series/services-gva-2011-share.json";
import gdpInd_raw from "../../data/series/gdp-2022-industries.json";
import ispGrowth_raw from "../../data/series/services-isp-growth.json";
import ispAnnual_raw from "../../data/series/services-isp-annual.json";
import tradeM_raw from "../../data/series/services-trade-monthly.json";
import bopA_raw from "../../data/series/services-bop-annual.json";
// the large bundles (jobs, enterprises, BoP detail) ride in the page as build-time picks of
// just the series the plates draw (src/pages/guides/services.astro, #svc-data): the whole
// files are megabytes and stay in the downloads and the every-series table
const PICK = JSON.parse(document.getElementById("svc-data")?.textContent || "{}");
const bopQ = PICK["services-bop-quarterly"], invQ = PICK["services-invisibles-quarterly"], jobsCy = PICK["services-jobs-cy25"], jobsAy = PICK["services-jobs-ay"];
const asuse = PICK["services-asuse"], asuseProfile = PICK["services-asuse-profile"];
import { MONO as sans, hydrate, a11y, addCrosshair, spark, downloadSVG, downloadPNG, saveBlob, fmt } from "../charts/plumbing.js";

import { roundRates, numWord } from "./precision.js";
// review-a (2026-10): rates at the precision the agency publishes, rounded once as they load
// (src/dossiers/precision.js), so every delta and spread on the page is redone from what is shown
const share22 = roundRates(share22_raw);
const growth22 = roundRates(growth22_raw);
const level22 = roundRates(level22_raw);
const share11 = roundRates(share11_raw);
const gdpInd = roundRates(gdpInd_raw);
const ispGrowth = roundRates(ispGrowth_raw);
const ispAnnual = roundRates(ispAnnual_raw);
const tradeM = roundRates(tradeM_raw);
const bopA = roundRates(bopA_raw);

const INK = "#161A22", GRID = "#F0F2F5", BASE = "#D3D7DE", MUTED = "#878D99", ACC = "#2E4BD8", GOLD = "#C47A16", PALE = "#B9C3F3", GREY = "#A3A9B4";
const W = 1184;
const baseStyle = { background: "transparent", fontFamily: sans, fontSize: "12px", color: MUTED, overflow: "visible" };
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const M3 = MONTHS.map((m) => m.slice(0, 3));
const setHTML = (id, h) => { const el = document.getElementById(id); if (el) el.innerHTML = h; };
const pc = (u) => `<span class="pc">${u}</span>`;
const lastIdx = (arr) => { for (let i = arr.length - 1; i >= 0; i--) if (arr[i] != null) return i; return -1; };
const fyOf = (iso) => { const y = +iso.slice(0, 4); return `${y}-${String((y + 1) % 100).padStart(2, "0")}`; };
const monthOf = (iso) => `${MONTHS[+iso.slice(5, 7) - 1]} ${iso.slice(0, 4)}`;
const qOf = (iso) => { const m = +iso.slice(5, 7) - 1; return `${M3[m]} to ${M3[m + 2]} ${iso.slice(0, 4)}`; };
const bn = (mn) => mn / 1000;
const csvOf = (header, rows) => [header.join(","), ...rows.map((r) => r.map((v) => (v == null ? "" : /[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : v)).join(","))].join("\n");
const short = (s, n = 44) => (s.length > n ? s.slice(0, n - 1).trimEnd() + "…" : s);

function wirePlate(id, plot, filename, csv) {
  const el = document.getElementById(id); if (!el) return;
  const meta = { title: el.querySelector(".plate-head h3")?.textContent.trim(), sub: el.querySelector(".plate-head .sub")?.textContent.trim(), foot: el.querySelector(".plotfoot .src")?.textContent.trim().replace(/\s+/g, " ") };
  el.querySelectorAll("[data-dl]").forEach((b) => b.addEventListener("click", () => {
    if (b.dataset.dl === "svg") downloadSVG(plot, filename, meta);
    if (b.dataset.dl === "png") downloadPNG(plot, filename, meta);
    if (b.dataset.dl === "csv") saveBlob(new Blob([csv], { type: "text/csv" }), filename + ".csv");
  }));
}
function mount(id, plot) { const el = document.getElementById(id); if (el) el.append(plot); return el; }

/* ======================== the figures the page leads with ======================== */
const SH = share22.series, iS = lastIdx(SH.services.data);
const shareNow = SH.services.data[iS], shareFirst = SH.services.data[0];
const fyNow = fyOf(share22.dates[iS]);
const A = bopA.series, iA = lastIdx(A.s1_2_1_credit.data);
const expFY = bn(A.s1_2_1_credit.data[iA]), netFY = bn(A.s1_2_1_net.data[iA]), merchFY = bn(A.s1_1_credit.data[iA]);
const fyTrade = fyOf(bopA.dates[iA]);
const JC = jobsCy.series, yJ = jobsCy.dates.at(-1).slice(0, 4);
const jobsNow = JC.tertiary__person_all_cws.data.at(-1);
const IG = ispGrowth.series, ispMonth = monthOf(ispGrowth.dates.at(-1));
const ispLatest = Object.entries(IG).map(([k, s]) => ({ k, label: s.label, v: s.data.at(-1) })).filter((d) => d.v != null).sort((a, b) => b.v - a.v);
const ispDouble = ispLatest.filter((d) => d.v >= 10).length;
const TM = tradeM.series, tmLast = tradeM.dates.at(-1);

setHTML("m-latest", `${fyNow} (output), ${monthOf(tmLast)} (trade)`);
setHTML("n-share", shareNow.toFixed(1) + pc("%"));
setHTML("d-share", `<b>${shareFirst.toFixed(1)}%</b> in ${fyOf(share22.dates[0])}`);
spark("nspark-share", { ...hydrate(share22).services, color: ACC });
setHTML("n-exp", "$" + Math.round(expFY) + pc(" bn"));
setHTML("d-exp", `<b>${fmt.bnAuto(netFY)}</b> more than India paid for services, ${fyTrade}`);
setHTML("n-jobs", jobsNow.toFixed(1) + pc("%"));
setHTML("d-jobs", `of workers, ${yJ}, current weekly status`);
setHTML("n-isp", String(ispDouble) + pc(" of " + ispLatest.length));
setHTML("d-isp", `sub-sectors grew 10% or more, ${ispMonth}`);

/* ======================== § 01 the current reading ======================== */
setHTML("u-reading", `${fyNow}, NAS base 2022-23; trade to ${monthOf(tmLast)}`);
setHTML("rb-share", shareNow.toFixed(1) + pc("%"));
setHTML("rb-side", fmt.bnAuto(TM.exports.data.at(-1)));
setHTML("rb-side-l", `services exports, ${monthOf(tmLast)}`);
setHTML("rt-fy", fyNow);
setHTML("rt-est", (share22.meta.estimates.split("; ").at(-1) || "").split(": ")[1]?.toLowerCase() ?? "latest");

/* ======================== § 02 what counts as services ======================== */
{
  // the 13 service sub-industries' share of GVA in the latest year the sub-industry table covers
  const GROUPS = [
    ["Trade, hotels, transport and communication", ["trade_repair", "hotels_restaurants", "road_transport", "railways", "transport_services", "storage", "air_transport", "water_transport", "communication"]],
    ["Finance, real estate and professional services", ["realty_prof", "finance"]],
    ["Public administration and other services", ["other_services", "public_admin"]],
  ];
  const iSub = lastIdx(SH.trade_repair.data), fySub = fyOf(share22.dates[iSub]);
  const SHORTL = { trade_repair: "Trade and repair", hotels_restaurants: "Hotels and restaurants", road_transport: "Road transport", railways: "Railways", transport_services: "Services incidental to transport", storage: "Storage",
    air_transport: "Air transport", water_transport: "Water transport", communication: "Communication and broadcasting", realty_prof: "Real estate, dwellings, professional", finance: "Financial services",
    other_services: "Other services: education, health, personal", public_admin: "Public administration and defence" };
  const rows = GROUPS.flatMap(([g, ks]) => ks.map((k) => ({ group: g, key: k, label: SHORTL[k], v: SH[k].data[iSub] }))).filter((r) => r.v != null);
  const order = rows.map((r) => r.label);
  const plot = Plot.plot({
    width: W, height: 40 + rows.length * 30, marginLeft: 300, marginRight: 90, marginTop: 24, marginBottom: 30, style: baseStyle,
    x: { label: null, domain: [0, 22], ticks: [0, 5, 10, 15, 20], tickFormat: (d) => d + "%", tickSize: 0 },
    y: { label: null, domain: order, tickSize: 0, tickPadding: 12 },
    marks: [
      Plot.gridX([5, 10, 15, 20], { stroke: GRID }),
      Plot.barX(rows, { y: "label", x: "v", fill: (d) => (d.group.startsWith("Finance") ? ACC : d.group.startsWith("Trade") ? "#5F6675" : GREY), insetTop: 6, insetBottom: 6 }),
      Plot.ruleX([0], { stroke: BASE }),
      Plot.text(rows, { y: "label", x: "v", text: (d) => d.v.toFixed(1) + "%", dx: 8, textAnchor: "start", fill: INK, fontSize: 12 }),
    ],
  });
  a11y(plot, "Services by industry, share of GVA", `In ${fySub}, real estate, dwellings and professional services were ${SH.realty_prof.data[iSub].toFixed(1)}% of GVA, trade and repair ${SH.trade_repair.data[iSub].toFixed(1)}%, other services ${SH.other_services.data[iSub].toFixed(1)}%.`);
  mount("plot-mix", plot);
  setHTML("pv-mix", SH.realty_prof.data[iSub].toFixed(1) + "%");
  setHTML("mix-fy", fySub);
  setHTML("ex-mix-fy", fySub);
  setHTML("ex-mix-realty", SH.realty_prof.data[iSub].toFixed(1) + "%");
  setHTML("ex-mix-trade", SH.trade_repair.data[iSub].toFixed(1) + "%");
  setHTML("ex-mix-other", SH.other_services.data[iSub].toFixed(1) + "%");
  setHTML("ex-mix-fin", SH.finance.data[iSub].toFixed(1) + "%");
  setHTML("ex-mix-svc", SH.services.data[iSub].toFixed(1) + "%");
  wirePlate("cb-mix", plot, "india-atlas_services-by-industry-share-of-gva", csvOf(["group", "industry", "share_of_gva_pct", "year"], rows.map((r) => [r.group, r.label, r.v, fySub])));
}

/* ======================== § 03 how big, and how fast ======================== */
{
  // two rulers, side by side: the 2011-12 base (pale) and the 2022-23 base (accent); never joined
  const old = hydrate(share11).services.data.filter((d) => d.value != null);
  const neu = hydrate(share22).services.data.filter((d) => d.value != null);
  const lastOld = old.at(-1), lastNew = neu.at(-1), firstOld = old[0];
  const seam = new Date(Date.UTC(2022, 3, 1));
  const plot = Plot.plot({
    width: W, height: 420, marginLeft: 48, marginRight: 230, marginTop: 30, marginBottom: 34, style: baseStyle,
    x: { label: null, tickSize: 0, tickPadding: 12, ticks: [2011, 2014, 2017, 2020, 2023, 2025].map((y) => new Date(Date.UTC(y, 3, 1))), tickFormat: (d) => `${d.getUTCFullYear()}-${String((d.getUTCFullYear() + 1) % 100).padStart(2, "0")}` },
    y: { label: "↑ services, share of GVA at current prices, per cent", labelAnchor: "top", labelArrow: false, domain: [48, 58], ticks: [48, 50, 52, 54, 56, 58], tickFormat: (d) => d + "%", tickSize: 0, tickPadding: 10 },
    marks: [
      Plot.gridY([50, 52, 54, 56, 58], { stroke: GRID }),
      Plot.ruleX([seam], { stroke: "#B5BAC4", strokeDasharray: "1 3" }),
      Plot.text([{ x: seam, y: 57.6 }], { x: "x", y: "y", text: () => "2022-23 base begins", dx: -8, textAnchor: "end", fill: MUTED, fontSize: 11.5 }),
      Plot.lineY(old, { x: "date", y: "value", stroke: PALE, strokeWidth: 1.75, strokeLinejoin: "round", strokeLinecap: "round" }),
      Plot.lineY(neu, { x: "date", y: "value", stroke: ACC, strokeWidth: 2, strokeLinejoin: "round", strokeLinecap: "round" }),
      Plot.dot([lastOld], { x: "date", y: "value", fill: PALE, r: 3, stroke: "#fff", strokeWidth: 1.5 }),
      Plot.dot([lastNew], { x: "date", y: "value", fill: ACC, r: 3.5, stroke: "#fff", strokeWidth: 1.5 }),
      Plot.text([lastOld], { x: "date", y: "value", text: (d) => `2011-12 base ${d.value.toFixed(1)}%`, dx: 10, dy: -8, textAnchor: "start", fill: MUTED, fontSize: 12 }),
      Plot.text([lastNew], { x: "date", y: "value", text: (d) => `2022-23 base ${d.value.toFixed(1)}%`, dx: 10, dy: 10, textAnchor: "start", fill: INK, fontSize: 12.5, fontWeight: 600 }),
    ],
  });
  a11y(plot, "Services' share of GVA on two bases", `On the 2011-12 base services rose from ${firstOld.value.toFixed(1)}% of GVA in ${fyOf(share11.dates[share11.series.services.data.findIndex((v) => v != null)])} to ${lastOld.value.toFixed(1)}%; on the 2022-23 base they are ${lastNew.value.toFixed(1)}% in ${fyOf(share22.dates.at(-1))}.`);
  mount("plot-long", plot);
  setHTML("pv-long", lastNew.value.toFixed(1) + "%");
  setHTML("ex-long-old0", firstOld.value.toFixed(1) + "%");
  setHTML("ex-long-old0y", fyOf(old[0].date.toISOString()));
  setHTML("ex-long-old1", lastOld.value.toFixed(1) + "%");
  setHTML("ex-long-old1y", fyOf(lastOld.date.toISOString()));
  setHTML("ex-long-new0", neu[0].value.toFixed(1) + "%");
  setHTML("ex-long-new1", lastNew.value.toFixed(1) + "%");
  setHTML("ex-long-new1y", fyOf(lastNew.date.toISOString()));
  const rows = [...share11.dates.map((d, i) => [d, "2011-12", share11.series.services.data[i]]), ...share22.dates.map((d, i) => [d, "2022-23", share22.series.services.data[i]])].filter((r) => r[2] != null);
  wirePlate("cb-long", plot, "india-atlas_services-share-of-gva-two-bases", csvOf(["year_start", "base", "services_share_of_gva_pct"], rows));
}
{
  // real growth by sub-industry, the two latest years of the sub-industry table (dumbbell)
  const G = growth22.series, i1 = lastIdx(G.trade_repair.data), i0 = i1 - 1;
  const KEYS = ["trade_repair", "hotels_restaurants", "railways", "road_transport", "water_transport", "air_transport", "transport_services", "storage", "communication", "finance", "realty_prof", "public_admin", "other_services"];
  const LAB = { trade_repair: "Trade and repair", hotels_restaurants: "Hotels and restaurants", railways: "Railways", road_transport: "Road transport", water_transport: "Water transport", air_transport: "Air transport",
    transport_services: "Services incidental to transport", storage: "Storage", communication: "Communication and broadcasting", finance: "Financial services", realty_prof: "Real estate, dwellings, professional",
    public_admin: "Public administration and defence", other_services: "Other services" };
  const rows = KEYS.map((k) => ({ k, label: LAB[k], a: G[k].data[i0], b: G[k].data[i1] })).filter((r) => r.a != null && r.b != null).sort((p, q) => q.b - p.b);
  const tot = { a: G.services.data[i0], b: G.services.data[i1] };
  const lo = Math.min(-10, ...rows.map((r) => Math.min(r.a, r.b))), hi = Math.max(30, ...rows.map((r) => Math.max(r.a, r.b)));
  const right = rows.map((r) => ({ ...r, x: Math.max(r.a, r.b) })), left = rows.map((r) => ({ ...r, x: Math.min(r.a, r.b) }));
  const plot = Plot.plot({
    width: W, height: 50 + rows.length * 30, marginLeft: 260, marginRight: 60, marginTop: 30, marginBottom: 30, style: baseStyle,
    x: { label: null, domain: [lo - 4, hi + 4], tickFormat: (d) => d + "%", tickSize: 0 },
    y: { label: null, domain: rows.map((r) => r.label), tickSize: 0, tickPadding: 12 },
    marks: [
      Plot.gridX({ stroke: GRID }),
      Plot.ruleX([0], { stroke: BASE }),
      Plot.ruleX([tot.b], { stroke: ACC, strokeDasharray: "3 3", strokeOpacity: 0.6 }),
      Plot.text([{ x: tot.b }], { x: "x", frameAnchor: "top", text: () => `All services ${tot.b.toFixed(1)}%`, dy: -16, textAnchor: "middle", fill: ACC === INK ? INK : INK, fontSize: 11.5 }),
      Plot.link(rows, { y1: "label", y2: "label", x1: "a", x2: "b", stroke: "#DFE2E8", strokeWidth: 2 }),
      Plot.dot(rows, { y: "label", x: "a", r: 4, fill: "#fff", stroke: MUTED, strokeWidth: 1.5 }),
      Plot.dot(rows, { y: "label", x: "b", r: 4.5, fill: ACC }),
      Plot.text(right, { y: "label", x: "x", text: (d) => (d.b >= d.a ? d.b.toFixed(1) + "%" : d.a.toFixed(1) + "%"), dx: 10, textAnchor: "start", fill: (d) => (d.b >= d.a ? INK : MUTED), fontSize: 12 }),
      Plot.text(left, { y: "label", x: "x", text: (d) => (d.b < d.a ? d.b.toFixed(1) + "%" : d.a.toFixed(1) + "%"), dx: -10, textAnchor: "end", fill: (d) => (d.b < d.a ? INK : MUTED), fontSize: 12 }),
    ],
  });
  a11y(plot, "Real growth of service sub-industries", `In ${fyOf(growth22.dates[i1])}, ${rows[0].label} grew fastest (${rows[0].b.toFixed(1)}%) and ${rows.at(-1).label} slowest (${rows.at(-1).b.toFixed(1)}%); all services ${tot.b.toFixed(1)}%.`);
  mount("plot-growth", plot);
  setHTML("lg-growth-a", fyOf(growth22.dates[i0]));
  setHTML("lg-growth-b", fyOf(growth22.dates[i1]));
  setHTML("pv-growth", tot.b.toFixed(1) + "%");
  setHTML("ex-gr-fy", fyOf(growth22.dates[i1]));
  setHTML("ex-gr-top", `${rows[0].label.toLowerCase()} (${rows[0].b.toFixed(1)}%)`);
  setHTML("ex-gr-bot", `${rows.at(-1).label.toLowerCase()} (${rows.at(-1).b.toFixed(1)}%)`);
  setHTML("ex-gr-tot", tot.b.toFixed(1) + "%");
  setHTML("ex-gr-gva", G.total_gva.data[i1].toFixed(1) + "%");
  setHTML("ex-gr-latest", `${fyOf(growth22.dates.at(-1))}: ${G.services.data.at(-1).toFixed(1)}%`);
  wirePlate("cb-growth", plot, "india-atlas_services-real-growth-by-sub-industry", csvOf(["sub_industry", `real_growth_${fyOf(growth22.dates[i0])}_pct`, `real_growth_${fyOf(growth22.dates[i1])}_pct`], rows.map((r) => [r.label, r.a, r.b])));
}
{
  // quarterly real growth of the three service groups (the GDP guide's bundle, read only)
  const Q = hydrate(gdpInd);
  const KEYS = [["finance_realty", ACC, "Finance, real estate, professional"], ["trade_transport", "#5F6675", "Trade, hotels, transport"], ["public_admin", GREY, "Public administration, other"]];
  const series = KEYS.map(([k, c, l]) => ({ ...Q[k], color: c, label: l }));
  const ends = series.map((s) => ({ s, e: s.data.filter((d) => d.value != null).at(-1) }));
  const sorted = [...ends].sort((a, b) => b.e.value - a.e.value); let prev = Infinity; for (const o of sorted) { o.y = Math.min(o.e.value, prev - 1.4); prev = o.y; }
  const vals = series.flatMap((s) => s.data.map((d) => d.value)).filter((v) => v != null);
  const plot = Plot.plot({
    width: W, height: 380, marginLeft: 44, marginRight: 320, marginTop: 30, marginBottom: 34, style: baseStyle,
    x: { label: null, tickSize: 0, tickPadding: 12, ticks: [...new Set(gdpInd.dates.map((d) => d.slice(0, 4)))].map((y) => new Date(Date.UTC(+y, 0, 1))).filter((d) => d >= new Date(gdpInd.dates[0] + "T00:00:00Z")), tickFormat: (d) => String(d.getUTCFullYear()) },
    y: { label: "↑ real growth, year on year, per cent", labelAnchor: "top", labelArrow: false, domain: [Math.min(0, ...vals), Math.max(...vals) + 1], tickFormat: (d) => d + "%", tickSize: 0, tickPadding: 10 },
    marks: [
      Plot.gridY({ stroke: GRID }),
      Plot.ruleY([0], { stroke: BASE }),
      ...series.map((s) => Plot.lineY(s.data, { x: "date", y: "value", stroke: s.color, strokeWidth: s.color === ACC ? 2 : 1.5, strokeLinejoin: "round", strokeLinecap: "round" })),
      ...ends.map((o) => Plot.dot([o.e], { x: "date", y: "value", fill: o.s.color, r: 3, stroke: "#fff", strokeWidth: 1.5 })),
      ...ends.map((o) => Plot.text([{ date: o.e.date, y: o.y }], { x: "date", y: "y", text: () => `${o.s.label} ${o.e.value.toFixed(1)}%`, dx: 10, textAnchor: "start", fill: INK, fontSize: 12, fontWeight: o.s.color === ACC ? 600 : 400 })),
    ],
  });
  a11y(plot, "Quarterly real growth of the three service groups", ends.map((o) => `${o.s.label} ${o.e.value.toFixed(1)}% in ${qOf(o.e.date.toISOString())}`).join("; ") + ".");
  const el = mount("plot-quarter", plot);
  addCrosshair(el, plot, series, null, (d) => qOf(d.toISOString()), (v) => (v == null ? "—" : v.toFixed(1) + "%"));
  setHTML("pv-quarter", fmt.pct1(Q.finance_realty.data.at(-1).value));
  setHTML("ex-q-q", qOf(gdpInd.dates.at(-1)));
  setHTML("ex-q-fin", fmt.pct1(Q.finance_realty.data.at(-1).value));
  setHTML("ex-q-trade", fmt.pct1(Q.trade_transport.data.at(-1).value));
  setHTML("ex-q-pub", fmt.pct1(Q.public_admin.data.at(-1).value));
  const rows = gdpInd.dates.map((d, i) => [d, ...KEYS.map(([k]) => gdpInd.series[k].data[i])]);
  wirePlate("cb-quarter", plot, "india-atlas_services-groups-quarterly-real-growth", csvOf(["quarter_start", ...KEYS.map(([k]) => k + "_real_yoy_pct")], rows));
}

/* ======================== § 04 the trial monthly index ======================== */
{
  const months = ispGrowth.dates;
  const rows = ispLatest.map((d) => d.label);
  const pts = Object.entries(IG).flatMap(([k, s]) => s.data.map((v, i) => ({ label: s.label, v, i, last: i === months.length - 1 }))).filter((p) => p.v != null);
  const lastPts = pts.filter((p) => p.last);
  const lo = Math.min(...pts.map((p) => p.v)), hi = Math.max(...pts.map((p) => p.v));
  const xMax = Math.ceil((hi + 2) / 10) * 10;
  const plot = Plot.plot({
    width: W, height: 50 + rows.length * 28, marginLeft: 380, marginRight: 70, marginTop: 30, marginBottom: 30, style: baseStyle,
    x: { label: null, domain: [Math.floor((lo - 2) / 10) * 10, xMax], tickFormat: (d) => d + "%", tickSize: 0 },
    y: { label: null, domain: rows, tickSize: 0, tickPadding: 12 },
    marks: [
      Plot.gridX({ stroke: GRID }),
      Plot.ruleX([0], { stroke: BASE }),
      Plot.dot(pts.filter((p) => !p.last), { y: "label", x: "v", r: 3, fill: "#C9CED6" }),
      Plot.dot(lastPts, { y: "label", x: "v", r: 4.5, fill: ACC }),
      Plot.text(lastPts, { y: "label", x: () => xMax, text: (d) => d.v.toFixed(1) + "%", dx: 14, textAnchor: "start", fill: INK, fontSize: 12 }),
    ],
  });
  a11y(plot, "Trial Index of Services Production, growth by sub-sector", `In ${ispMonth}, ${ispLatest[0].label} grew ${ispLatest[0].v.toFixed(1)}% and ${ispLatest.at(-1).label} ${ispLatest.at(-1).v.toFixed(1)}%; ${ispDouble} of ${ispLatest.length} sub-sectors grew 10% or more.`);
  mount("plot-isp", plot);
  setHTML("lg-isp-m", ispMonth);
  setHTML("lg-isp-span", `${monthOf(months[0])} to ${monthOf(months.at(-2))}`);
  setHTML("pv-isp", `${ispDouble} of ${ispLatest.length}`);
  setHTML("ex-isp-m", ispMonth);
  setHTML("ex-isp-top", `${ispLatest[0].label} (${ispLatest[0].v.toFixed(1)}%)`);
  setHTML("ex-isp-bot", `${ispLatest.at(-1).label} (${ispLatest.at(-1).v.toFixed(1)}%)`);
  setHTML("ex-isp-n", String(ispDouble));
  setHTML("ex-isp-neg", numWord(ispLatest.filter((d) => d.v < 0).length));
  const csv = csvOf(["sub_sector", ...months.map((m) => m.slice(0, 7) + "_yoy_pct")], Object.values(IG).map((s) => [s.label, ...s.data]));
  wirePlate("cb-isp", plot, "india-atlas_isp-growth-by-sub-sector", csv);
}
{
  const S = ispAnnual.series, fy = fyOf(ispAnnual.dates.at(-1));
  const rows = Object.values(S).map((s) => ({ label: s.label, v: s.data.at(-1) - 100 })).filter((r) => r.v != null).sort((a, b) => b.v - a.v);
  const plot = Plot.plot({
    width: W, height: 40 + rows.length * 26, marginLeft: 380, marginRight: 80, marginTop: 24, marginBottom: 30, style: baseStyle,
    x: { label: null, domain: [Math.min(-5, ...rows.map((r) => r.v)), Math.max(...rows.map((r) => r.v)) + 4], tickFormat: (d) => d + "%", tickSize: 0 },
    y: { label: null, domain: rows.map((r) => r.label), tickSize: 0, tickPadding: 12 },
    marks: [
      Plot.gridX({ stroke: GRID }),
      Plot.barX(rows, { y: "label", x: "v", fill: (d) => (d.v < 0 ? GOLD : ACC), insetTop: 6, insetBottom: 6 }),
      Plot.ruleX([0], { stroke: BASE }),
      Plot.text(rows.filter((r) => r.v >= 0), { y: "label", x: "v", text: (d) => d.v.toFixed(1) + "%", dx: 8, textAnchor: "start", fill: INK, fontSize: 12 }),
      Plot.text(rows.filter((r) => r.v < 0), { y: "label", x: 0, text: (d) => d.v.toFixed(1) + "%", dx: 8, textAnchor: "start", fill: INK, fontSize: 12 }),
    ],
  });
  a11y(plot, `Trial ISP, ${fy} against 2024-25`, `${rows[0].label} grew ${rows[0].v.toFixed(1)}%, ${rows.at(-1).label} ${rows.at(-1).v.toFixed(1)}%.`);
  mount("plot-ispa", plot);
  setHTML("pv-ispa", rows[0].v.toFixed(1) + "%");
  setHTML("ispa-fy", fy);
  setHTML("ex-ispa-fy", fy);
  setHTML("ex-ispa-top", `${rows[0].label} (${rows[0].v.toFixed(1)}%)`);
  setHTML("ex-ispa-bot", `${rows.at(-1).label} (${rows.at(-1).v.toFixed(1)}%)`);
  wirePlate("cb-ispa", plot, "india-atlas_isp-annual-growth", csvOf(["sub_sector", `index_${fy}_base_2024_25_100`], Object.values(S).map((s) => [s.label, s.data.at(-1)])));
}

/* ======================== § 05 selling services to the world ======================== */
{
  // 76 years, log scale: receipts, payments and software receipts (from 1997-98)
  const H = hydrate(bopA);
  const toBn = (s) => s.data.filter((d) => d.value != null && d.value > 0).map((d) => ({ date: d.date, value: d.value / 1000 }));
  const exp = toBn(H.s1_2_1_credit), imp = toBn(H.s1_2_1_debit), sw = toBn(H.s1_2_1_5_1_credit);
  const ends = [[exp, ACC, "Services exports", 600], [imp, GOLD, "Services imports", 400], [sw, "#5F6675", "of which software", 400]].map(([d, c, l, w]) => ({ e: d.at(-1), c, l, w }));
  const sorted = [...ends].sort((a, b) => b.e.value - a.e.value); let prevY = Infinity; for (const o of sorted) { o.y = Math.min(o.e.value, prevY / 1.45); prevY = o.y; }
  const plot = Plot.plot({
    width: W, height: 460, marginLeft: 76, marginRight: 250, marginTop: 30, marginBottom: 34, style: baseStyle,
    x: { label: null, tickSize: 0, tickPadding: 12, ticks: [1950, 1960, 1970, 1980, 1990, 2000, 2010, 2020].map((y) => new Date(Date.UTC(y, 3, 1))), tickFormat: (d) => `${d.getUTCFullYear()}-${String((d.getUTCFullYear() + 1) % 100).padStart(2, "0")}` },
    y: { type: "log", label: "↑ US$ billion a year, logarithmic scale", labelAnchor: "top", labelArrow: false, domain: [0.1, 1000], ticks: [0.1, 1, 10, 100, 1000], tickFormat: (d) => (d < 1 ? "$" + d.toFixed(1) : "$" + d.toLocaleString("en-IN")) + " bn", tickSize: 0, tickPadding: 10 },
    marks: [
      Plot.gridY([1, 10, 100, 1000], { stroke: GRID }),
      Plot.lineY(imp, { x: "date", y: "value", stroke: GOLD, strokeWidth: 1.5, strokeLinejoin: "round" }),
      Plot.lineY(sw, { x: "date", y: "value", stroke: "#5F6675", strokeWidth: 1.5, strokeLinejoin: "round" }),
      Plot.lineY(exp, { x: "date", y: "value", stroke: ACC, strokeWidth: 2, strokeLinejoin: "round", strokeLinecap: "round" }),
      ...ends.map((o) => Plot.dot([o.e], { x: "date", y: "value", fill: o.c, r: 3, stroke: "#fff", strokeWidth: 1.5 })),
      ...ends.map((o) => Plot.text([{ date: o.e.date, y: o.y }], { x: "date", y: "y", text: () => `${o.l} ${fmt.bnAuto(o.e.value)}`, dx: 10, textAnchor: "start", fill: INK, fontSize: 12, fontWeight: o.c === ACC ? 600 : 400 })),
    ],
  });
  const e0 = exp[0];
  a11y(plot, "India's services trade since 1950-51", `Services exports were ${fmt.bnAuto(e0.value)} in ${fyOf(e0.date.toISOString())} and ${fmt.bnAuto(exp.at(-1).value)} in ${fyTrade}; software exports ${fmt.bnAuto(sw.at(-1).value)}.`);
  mount("plot-trade-long", plot);
  setHTML("pv-trade-long", fmt.bnAuto(expFY));
  setHTML("ex-tl-fy", fyTrade);
  setHTML("ex-tl-exp", fmt.bnAuto(expFY));
  setHTML("ex-tl-imp", fmt.bnAuto(bn(A.s1_2_1_debit.data[iA])));
  setHTML("ex-tl-sw", fmt.bnAuto(bn(A.s1_2_1_5_1_credit.data[iA])));
  setHTML("ex-tl-swsh", ((100 * A.s1_2_1_5_1_credit.data[iA]) / A.s1_2_1_credit.data[iA]).toFixed(1) + "%");
  setHTML("ex-tl-merch", ((100 * A.s1_2_1_credit.data[iA]) / A.s1_1_credit.data[iA]).toFixed(1) + "%");
  setHTML("ex-tl-e0", fmt.bnAuto(e0.value));
  setHTML("ex-tl-e0y", fyOf(e0.date.toISOString()));
  const keys = ["s1_2_1_credit", "s1_2_1_debit", "s1_2_1_net", "s1_2_1_5_1_credit", "s1_1_credit"];
  wirePlate("cb-trade-long", plot, "india-atlas_services-trade-since-1950", csvOf(["year_start", ...keys.map((k) => bopA.series[k].name)], bopA.dates.map((d, i) => [d, ...keys.map((k) => bopA.series[k].data[i])])));
}
{
  // monthly: exports, imports (RBI's monthly table)
  const H = hydrate(tradeM);
  const series = [{ ...H.exports, color: ACC, label: "Exports" }, { ...H.imports, color: GOLD, label: "Imports" }];
  const ends = series.map((s) => ({ s, e: s.data.filter((d) => d.value != null).at(-1) }));
  const plot = Plot.plot({
    width: W, height: 380, marginLeft: 50, marginRight: 160, marginTop: 30, marginBottom: 34, style: baseStyle,
    x: { label: null, tickSize: 0, tickPadding: 12, ticks: [2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026].map((y) => new Date(Date.UTC(y, 0, 1))), tickFormat: (d) => String(d.getUTCFullYear()) },
    y: { label: "↑ US$ billion a month", labelAnchor: "top", labelArrow: false, domain: [0, 50], ticks: [0, 10, 20, 30, 40, 50], tickFormat: (d) => "$" + d + " bn", tickSize: 0, tickPadding: 10 },
    marks: [
      Plot.gridY([10, 20, 30, 40, 50], { stroke: GRID }),
      Plot.ruleY([0], { stroke: BASE }),
      ...series.map((s) => Plot.lineY(s.data, { x: "date", y: "value", stroke: s.color, strokeWidth: s.color === ACC ? 2 : 1.5, strokeLinejoin: "round", strokeLinecap: "round" })),
      ...ends.map((o) => Plot.dot([o.e], { x: "date", y: "value", fill: o.s.color, r: 3, stroke: "#fff", strokeWidth: 1.5 })),
      ...ends.map((o) => Plot.text([o.e], { x: "date", y: "value", text: (d) => `${o.s.label} ${fmt.bnFixed1(d.value)}`, dx: 10, textAnchor: "start", fill: INK, fontSize: 12, fontWeight: o.s.color === ACC ? 600 : 400 })),
    ],
  });
  a11y(plot, "Monthly services exports and imports", `In ${monthOf(tmLast)} services exports were ${fmt.bnFixed1(TM.exports.data.at(-1))} and imports ${fmt.bnFixed1(TM.imports.data.at(-1))}.`);
  const el = mount("plot-monthly", plot);
  addCrosshair(el, plot, series, null, (d) => monthOf(d.toISOString()), (v) => (v == null ? "—" : fmt.bnFixed1(v)));
  const yAgo = TM.exports.data[tradeM.dates.length - 13];
  setHTML("pv-monthly", fmt.bnFixed1(TM.exports.data.at(-1)));
  setHTML("ex-mo-m", monthOf(tmLast));
  setHTML("ex-mo-exp", fmt.bnFixed1(TM.exports.data.at(-1)));
  setHTML("ex-mo-imp", fmt.bnFixed1(TM.imports.data.at(-1)));
  setHTML("ex-mo-net", fmt.bnFixed1(TM.net.data.at(-1)));
  setHTML("ex-mo-yoy", yAgo ? fmt.pct1Minus(100 * (TM.exports.data.at(-1) / yAgo - 1)) : "—");
  wirePlate("cb-monthly", plot, "india-atlas_services-trade-monthly", csvOf(["month", "exports_usd_bn", "imports_usd_bn", "net_usd_bn"], tradeM.dates.map((d, i) => [d.slice(0, 7), TM.exports.data[i], TM.imports.data[i], TM.net.data[i]])));
}
{
  // what India sells: the BPM6 categories over the last four quarters, exports and imports
  const S = bopQ.series, n = bopQ.dates.length, from = bopQ.dates[n - 4], to = bopQ.dates.at(-1);
  const sum4 = (k) => S[k].data.slice(-4).reduce((a, v) => a + (v ?? 0), 0) / 1000;
  const NAMES = { 9: "Telecom, computer and information", 10: "Other business services", 3: "Transport", 4: "Travel", 7: "Financial services", 5: "Construction", 11: "Personal, cultural, recreational", 6: "Insurance and pension",
    8: "Charges for intellectual property", 1: "Manufacturing on others' inputs", 2: "Maintenance and repair", 12: "Government, n.i.e.", 13: "Others, n.i.e." };
  const rows = Object.entries(NAMES).map(([c, l]) => ({ label: l, c: +c, exp: sum4(`1_a_b_${c}_credit`), imp: sum4(`1_a_b_${c}_debit`) })).sort((a, b) => b.exp - a.exp);
  const long = rows.flatMap((r) => [{ label: r.label, flow: "Exports", v: r.exp }, { label: r.label, flow: "Imports", v: r.imp }]);
  const total = sum4("1_a_b_credit");
  const plot = Plot.plot({
    width: W, height: 50 + rows.length * 36, marginLeft: 280, marginRight: 90, marginTop: 24, marginBottom: 30, style: baseStyle,
    x: { label: null, domain: [0, Math.ceil((Math.max(...rows.map((r) => r.exp)) + 20) / 50) * 50], ticks: 6, tickFormat: (d) => "$" + d + " bn", tickSize: 0 },
    y: { label: null, domain: rows.map((r) => r.label), tickSize: 0, tickPadding: 12 },
    fy: { axis: null },
    marks: [
      Plot.gridX({ stroke: GRID }),
      Plot.barX(long.filter((d) => d.flow === "Exports"), { y: "label", x: "v", fill: ACC, insetTop: 5, insetBottom: 17 }),
      Plot.barX(long.filter((d) => d.flow === "Imports"), { y: "label", x: "v", fill: GOLD, insetTop: 19, insetBottom: 5 }),
      Plot.ruleX([0], { stroke: BASE }),
      Plot.text(rows, { y: "label", x: (d) => Math.max(d.exp, d.imp), text: (d) => `${fmt.bnAuto(d.exp)} out, ${fmt.bnAuto(d.imp)} in`, dx: 8, textAnchor: "start", fill: INK, fontSize: 11.5 }),
    ],
  });
  a11y(plot, "India's services trade by category", `Over ${qOf(from)} to ${qOf(to)}, telecom, computer and information services exports were ${fmt.bnAuto(rows.find((r) => r.c === 9).exp)} of ${fmt.bnAuto(total)}.`);
  mount("plot-cats", plot);
  const ict = rows.find((r) => r.c === 9), obs = rows.find((r) => r.c === 10);
  const spanTxt = `${M3[+from.slice(5, 7) - 1]} ${from.slice(0, 4)} to ${M3[+to.slice(5, 7) + 1]} ${to.slice(0, 4)}`;
  setHTML("cats-span", spanTxt);
  setHTML("pv-cats", ((100 * (ict.exp + obs.exp)) / total).toFixed(1) + "%");
  setHTML("ex-c-span", spanTxt);
  setHTML("ex-c-ict", fmt.bnAuto(ict.exp));
  setHTML("ex-c-obs", fmt.bnAuto(obs.exp));
  setHTML("ex-c-tot", fmt.bnAuto(total));
  setHTML("ex-c-ip", fmt.bnAuto(rows.find((r) => r.c === 8).imp));
  setHTML("ex-c-tr", fmt.bnAuto(rows.find((r) => r.c === 3).imp));
  setHTML("ex-c-ver", (bopQ.meta.versions?.[to] ?? "").toLowerCase());
  wirePlate("cb-cats", plot, "india-atlas_services-trade-by-category", csvOf(["category", "exports_usd_bn_4q", "imports_usd_bn_4q", "from_quarter", "to_quarter"], rows.map((r) => [r.label, r.exp.toFixed(3), r.imp.toFixed(3), from, to])));
}
{
  // the work behind global capability centres: R&D, consulting, technical services (purpose codes)
  const H = hydrate(invQ);
  const KEYS = [["r60", ACC, "Professional and management consulting"], ["r68", "#5F6675", "Technical and trade-related services"], ["r57", GOLD, "Research and development"]];
  const series = KEYS.map(([k, c, l]) => ({ ...H[k], color: c, label: l, data: H[k].data.map((d) => ({ date: d.date, value: d.value == null ? null : d.value / 1000 })) }));
  const ends = series.map((s) => ({ s, e: s.data.filter((d) => d.value != null).at(-1) }));
  const sorted = [...ends].sort((a, b) => b.e.value - a.e.value); let prev = Infinity; for (const o of sorted) { o.y = Math.min(o.e.value, prev - 1.6); prev = o.y; }
  const vmax = Math.max(...series.flatMap((s) => s.data.map((d) => d.value ?? 0)));
  const plot = Plot.plot({
    width: W, height: 380, marginLeft: 50, marginRight: 380, marginTop: 30, marginBottom: 34, style: baseStyle,
    x: { label: null, tickSize: 0, tickPadding: 12, ticks: [2012, 2014, 2016, 2018, 2020, 2022, 2024].map((y) => new Date(Date.UTC(y, 0, 1))), tickFormat: (d) => String(d.getUTCFullYear()) },
    y: { label: "↑ receipts, US$ billion a quarter", labelAnchor: "top", labelArrow: false, domain: [0, Math.ceil(vmax / 5) * 5], ticks: 5, tickFormat: (d) => "$" + d + " bn", tickSize: 0, tickPadding: 10 },
    marks: [
      Plot.gridY({ stroke: GRID }),
      Plot.ruleY([0], { stroke: BASE }),
      ...series.map((s) => Plot.lineY(s.data, { x: "date", y: "value", stroke: s.color, strokeWidth: s.color === ACC ? 2 : 1.5, strokeLinejoin: "round", strokeLinecap: "round" })),
      ...ends.map((o) => Plot.dot([o.e], { x: "date", y: "value", fill: o.s.color, r: 3, stroke: "#fff", strokeWidth: 1.5 })),
      ...ends.map((o) => Plot.text([{ date: o.e.date, y: o.y }], { x: "date", y: "y", text: () => `${o.s.label} ${fmt.bnFixed1(o.e.value)}`, dx: 10, textAnchor: "start", fill: INK, fontSize: 12, fontWeight: o.s.color === ACC ? 600 : 400 })),
    ],
  });
  a11y(plot, "Business services receipts by purpose", ends.map((o) => `${o.s.label} ${fmt.bnFixed1(o.e.value)}`).join("; ") + ` in ${qOf(invQ.dates.at(-1))}.`);
  const el = mount("plot-gcc", plot);
  addCrosshair(el, plot, series, null, (d) => qOf(d.toISOString()), (v) => (v == null ? "—" : fmt.bnFixed1(v)));
  const S = invQ.series, iq = invQ.dates.length - 1, i0 = invQ.dates.indexOf(`${+invQ.dates.at(-1).slice(0, 4) - 5}${invQ.dates.at(-1).slice(4)}`);
  setHTML("pv-gcc", fmt.bnFixed1(S.r60.data[iq] / 1000));
  setHTML("ex-g-q", qOf(invQ.dates.at(-1)));
  setHTML("ex-g-cons", fmt.bnFixed1(S.r60.data[iq] / 1000));
  setHTML("ex-g-cons5", i0 >= 0 ? fmt.bnFixed1(S.r60.data[i0] / 1000) : "—");
  setHTML("ex-g-q5", i0 >= 0 ? qOf(invQ.dates[i0]) : "—");
  setHTML("ex-g-rd", fmt.bnFixed1(S.r57.data[iq] / 1000));
  setHTML("ex-g-sw", fmt.bnFixed1(S.r41.data[iq] / 1000));
  wirePlate("cb-gcc", plot, "india-atlas_business-services-receipts-by-purpose", csvOf(["quarter_start", ...["r41", "r56", "r57", "r60", "r63", "r68"].map((k) => S[k].name)], invQ.dates.map((d, i) => [d, ...["r41", "r56", "r57", "r60", "r63", "r68"].map((k) => S[k].data[i])])));
}

/* ======================== § 06 who works in services ======================== */
const SECTIONS = { g: "Trade and vehicle repair", h: "Transport and storage", i: "Hotels and restaurants", j: "Information and communication", k: "Finance and insurance", l: "Real estate", m: "Professional, scientific, technical", n: "Administrative and support",
  o: "Public administration and defence", p: "Education", q: "Health and social work", r: "Arts and recreation", s: "Other personal services", t: "Households as employers (domestic work)", u: "International bodies" };
{
  // the revamped design's latest calendar year (services-jobs-cy25); never set beside the original design's years
  const y1 = jobsCy.dates.length - 1;
  const rows = Object.entries(SECTIONS).map(([c, l]) => ({ c, label: l, b: JC[`sec_${c}__person_all_ps`]?.data[y1], f: JC[`sec_${c}__female_all_ps`]?.data[y1], m: JC[`sec_${c}__male_all_ps`]?.data[y1] }))
    .filter((r) => r.b != null && r.c !== "u").sort((p, q) => q.b - p.b);
  const svc = rows.reduce((a, r) => a + r.b, 0);
  const xEnd = Math.ceil(Math.max(...rows.flatMap((r) => [r.b, r.f, r.m]).filter((v) => v != null)) / 2) * 2 + 2;
  const plot = Plot.plot({
    width: W, height: 50 + rows.length * 30, marginLeft: 300, marginRight: 140, marginTop: 30, marginBottom: 30, style: baseStyle,
    x: { label: null, domain: [0, xEnd], tickFormat: (d) => d + "%", tickSize: 0 },
    y: { label: null, domain: rows.map((r) => r.label), tickSize: 0, tickPadding: 12 },
    marks: [
      Plot.gridX({ stroke: GRID }),
      Plot.ruleX([0], { stroke: BASE }),
      Plot.link(rows, { y1: "label", y2: "label", x1: "f", x2: "m", stroke: "#DFE2E8", strokeWidth: 2 }),
      Plot.dot(rows, { y: "label", x: "m", r: 4, fill: "#5F6675" }),
      Plot.dot(rows, { y: "label", x: "f", r: 4, fill: GOLD }),
      Plot.dot(rows, { y: "label", x: "b", r: 5.5, fill: "none", stroke: ACC, strokeWidth: 2 }),
      Plot.text(rows, { y: "label", x: () => xEnd, text: (d) => d.b.toFixed(1) + "%", dx: 16, textAnchor: "start", fill: INK, fontSize: 12 }),
    ],
  });
  a11y(plot, "Service workers by industry", `In ${yJ}, ${rows[0].label} employed ${rows[0].b.toFixed(1)}% of all workers; the service sections together ${svc.toFixed(1)}%.`);
  mount("plot-jobs", plot);
  setHTML("jobs-y", yJ);
  setHTML("pv-jobs", svc.toFixed(1) + "%");
  setHTML("ex-j-y", yJ);
  setHTML("ex-j-svc", svc.toFixed(1) + "%");
  setHTML("ex-j-trade", rows.find((r) => r.c === "g").b.toFixed(1) + "%");
  setHTML("ex-j-ict", rows.find((r) => r.c === "j").b.toFixed(1) + "%");
  setHTML("ex-j-edu-f", rows.find((r) => r.c === "p").f.toFixed(1) + "%");
  setHTML("ex-j-edu-m", rows.find((r) => r.c === "p").m.toFixed(1) + "%");
  setHTML("ex-j-dom-f", rows.find((r) => r.c === "t").f.toFixed(1) + "%");
  setHTML("ex-j-agri", JC.sec_a__person_all_ps.data[y1].toFixed(1) + "%");
  wirePlate("cb-jobs", plot, "india-atlas_service-workers-by-industry", csvOf(["nic_section", "industry", `persons_${yJ}_pct`, `women_${yJ}_pct`, `men_${yJ}_pct`], rows.map((r) => [r.c.toUpperCase(), r.label, r.b, r.f, r.m])));
}
{
  // services' share of workers: men and women, rural and urban, CWS, the revamped design's calendar years
  // (services-jobs-cy25; the original design's 2023-24 are another ruler, not drawn beside it)
  const cells = [["male", "rural", "Men, rural"], ["female", "rural", "Women, rural"], ["male", "urban", "Men, urban"], ["female", "urban", "Women, urban"], ["person", "all", "Everyone"]];
  const rows = cells.flatMap(([g, s, l]) => jobsCy.dates.map((d, i) => ({ label: l, year: d.slice(0, 4), v: JC[`tertiary__${g}_${s}_cws`]?.data[i] }))).filter((r) => r.v != null);
  const years = jobsCy.dates.map((d) => d.slice(0, 4));
  const last = rows.filter((r) => r.year === years.at(-1));
  const plot = Plot.plot({
    width: W, height: 300, marginLeft: 160, marginRight: 80, marginTop: 24, marginBottom: 30, style: baseStyle,
    x: { label: null, domain: [0, 70], ticks: [0, 10, 20, 30, 40, 50, 60, 70], tickFormat: (d) => d + "%", tickSize: 0 },
    y: { label: null, domain: cells.map((c) => c[2]), tickSize: 0, tickPadding: 12 },
    marks: [
      Plot.gridX({ stroke: GRID }),
      Plot.ruleX([0], { stroke: BASE }),
      Plot.dot(rows.filter((r) => r.year !== years.at(-1)), { y: "label", x: "v", r: 3.5, fill: "#C9CED6" }),
      Plot.dot(last, { y: "label", x: "v", r: 5, fill: ACC }),
      Plot.text(last, { y: "label", x: "v", text: (d) => d.v.toFixed(1) + "%", dx: 12, textAnchor: "start", fill: INK, fontSize: 12 }),
    ],
  });
  a11y(plot, "Services' share of workers by sex and place", last.map((r) => `${r.label} ${r.v.toFixed(1)}%`).join("; ") + ` in ${years.at(-1)}.`);
  mount("plot-who", plot);
  setHTML("who-y", years.length > 1 ? `${years.at(-1)} (grey: ${years[0]}${years.length > 2 ? " to " + years.at(-2) : ""}, same design)` : years.at(-1));
  const v = (l) => last.find((r) => r.label === l).v;
  setHTML("pv-who", v("Women, urban").toFixed(1) + "%");
  setHTML("ex-w-y", years.at(-1));
  setHTML("ex-w-fu", v("Women, urban").toFixed(1) + "%");
  setHTML("ex-w-fr", v("Women, rural").toFixed(1) + "%");
  setHTML("ex-w-mu", v("Men, urban").toFixed(1) + "%");
  setHTML("ex-w-mr", v("Men, rural").toFixed(1) + "%");
  wirePlate("cb-who", plot, "india-atlas_services-share-of-workers-by-sex-and-place", csvOf(["group", "calendar_year", "services_share_of_workers_pct_cws"], rows.map((r) => [r.label, r.year, r.v])));
}
{
  // how service workers are employed: status within each service group (agriculture-year reports)
  const J = jobsAy.series, yi = jobsAy.dates.length - 1, ay = `${jobsAy.dates[yi].slice(0, 4)}-${String((+jobsAy.dates[yi].slice(0, 4) + 1) % 100).padStart(2, "0")}`;
  const GROUPS = [["trade", "Trade"], ["transport", "Transport"], ["accommodation_food", "Hotels and food"], ["other_services", "Other services"], ["tertiary", "All services"], ["manufacturing", "Manufacturing, for comparison"]];
  const STATUS = [["own_account", "Own-account and employers", "#5F6675"], ["helper", "Unpaid family helpers", "#A3A9B4"], ["regular", "Regular wage or salary", ACC], ["casual", "Casual labour", GOLD]];
  const rows = GROUPS.flatMap(([g, gl]) => STATUS.map(([s, sl, c]) => ({ group: gl, status: sl, color: c, v: J[`${s}__${g}__person_all_ps`]?.data[yi] ?? null }))).filter((r) => r.v != null);
  const plot = Plot.plot({
    width: W, height: 60 + GROUPS.length * 44, marginLeft: 220, marginRight: 40, marginTop: 40, marginBottom: 30, style: baseStyle,
    x: { label: null, domain: [0, 100], ticks: [0, 25, 50, 75, 100], tickFormat: (d) => d + "%", tickSize: 0 },
    y: { label: null, domain: GROUPS.map((g) => g[1]), tickSize: 0, tickPadding: 12 },
    color: { domain: STATUS.map((s) => s[1]), range: STATUS.map((s) => s[2]) },
    marks: [
      Plot.barX(rows, Plot.stackX({ y: "group", x: "v", fill: "status", order: STATUS.map((s) => s[1]), insetTop: 8, insetBottom: 8 })),
      Plot.text(rows, Plot.stackX({ y: "group", x: "v", z: "status", order: STATUS.map((s) => s[1]), text: (d) => (d.v >= 7 ? d.v.toFixed(0) + "%" : ""), fill: (d) => (d.color === "#A3A9B4" ? INK : "#fff"), fontSize: 11.5, className: "on-fill" })),
    ],
  });
  a11y(plot, "How service workers are employed", `In ${ay}, ${J.regular__tertiary__person_all_ps.data[yi].toFixed(1)}% of service workers had a regular wage or salary; in trade ${J.regular__trade__person_all_ps.data[yi].toFixed(1)}%.`);
  mount("plot-status", plot);
  setHTML("lg-status", STATUS.map(([, l, c]) => `<button class="chip"><i style="background:${c}"></i>${l}</button>`).join(""));
  setHTML("status-ay", ay);
  setHTML("pv-status", J.regular__tertiary__person_all_ps.data[yi].toFixed(1) + "%");
  setHTML("ex-s-ay", ay);
  setHTML("ex-s-reg", J.regular__tertiary__person_all_ps.data[yi].toFixed(1) + "%");
  setHTML("ex-s-trade-se", J.self_employed__trade__person_all_ps.data[yi].toFixed(1) + "%");
  setHTML("ex-s-oth-reg", J.regular__other_services__person_all_ps.data[yi].toFixed(1) + "%");
  setHTML("ex-s-acc-cas", J.casual__accommodation_food__person_all_ps.data[yi].toFixed(1) + "%");
  wirePlate("cb-status", plot, "india-atlas_service-workers-by-status", csvOf(["group", "status", `share_pct_${ay}`], rows.map((r) => [r.group, r.status, r.v])));
}

/* ======================== § 07 the informal service economy ======================== */
const AS = asuse.series, AP = asuseProfile.series, asY = asuse.dates.length - 1, asFy = fyOf(asuse.dates[asY]);
const ACTS = [
  ["other_retail_trade", "Shops: other retail trade"], ["other_wholesale_trade", "Other wholesale trade"], ["wholesale_and_retail_trade_of_motor_vehicles_and_motor_cycles", "Vehicle sales"],
  ["maintenance_and_repair_of_motor_vehicles_and_motor_cycles", "Vehicle repair"], ["wholesale_on_fee_or_contract", "Wholesale on commission"], ["food_and_accommodation_service_activities", "Food service: eateries, dhabas"],
  ["accommodation", "Accommodation"], ["land_transport", "Land transport"], ["water_transport", "Water transport"], ["warehousing_and_storage", "Warehousing and storage"],
  ["support_activities_for_transportation_postal_and_courier_activities", "Transport support, post, courier"], ["information_and_communication", "Information and communication"],
  ["financial_service_activities_except_insurance_and_pension_funding", "Financial services"], ["other_financial_activities", "Other financial activities"], ["real_estate_activities", "Real estate"],
  ["professional_scientific_and_technical_activities", "Professional and technical"], ["administrative_and_support_service_activities", "Administrative and support"], ["education", "Education: tutors, coaching"],
  ["human_health_and_social_work_activities", "Health: clinics, nursing"], ["other_community_social_and_personal_service_activities", "Personal services: tailors, barbers, laundry"],
];
const MID = { establishments: "estimated_no_of_establishments", workers: "all__all" };
const asKey = (ind, act, sector = "combined", et = "all") => `${ind}${MID[ind] ? "__" + MID[ind] : ""}__${act}__${sector}__${et}`;
{
  const wKey = (act) => asKey("workers", act);
  const rows = ACTS.map(([a, l]) => ({ a, label: l, est: AS[asKey("establishments", a)]?.data[asY], wk: AS[wKey(a)]?.data[asY] })).filter((r) => r.est != null && r.wk != null).sort((p, q) => q.wk - p.wk);
  const totW = AS[wKey("other_services_group")]?.data[asY] + AS[wKey("trading")]?.data[asY];
  const allW = AS[wKey("all_activities")]?.data[asY];
  const plot = Plot.plot({
    width: W, height: 40 + rows.length * 28, marginLeft: 330, marginRight: 150, marginTop: 24, marginBottom: 30, style: baseStyle,
    x: { label: null, domain: [0, Math.ceil(Math.max(...rows.map((r) => r.wk)) / 1e7)], tickFormat: (d) => d + " crore", tickSize: 0 },
    y: { label: null, domain: rows.map((r) => r.label), tickSize: 0, tickPadding: 12 },
    marks: [
      Plot.gridX({ stroke: GRID }),
      Plot.barX(rows, { y: "label", x: (d) => d.wk / 1e7, fill: ACC, insetTop: 6, insetBottom: 6 }),
      Plot.ruleX([0], { stroke: BASE }),
      Plot.text(rows, { y: "label", x: (d) => d.wk / 1e7, text: (d) => `${(d.wk / 1e5).toFixed(1)} lakh workers`, dx: 8, textAnchor: "start", fill: INK, fontSize: 12 }),
    ],
  });
  a11y(plot, "Workers in informal service enterprises by activity", `In ${asFy}, ${rows[0].label} employed ${(rows[0].wk / 1e5).toFixed(1)} lakh workers in unincorporated enterprises.`);
  mount("plot-asize", plot);
  setHTML("asize-fy", asFy);
  setHTML("pv-asize", (totW / 1e7).toFixed(1) + " crore");
  setHTML("ex-as-fy", asFy);
  setHTML("ex-as-tot", (totW / 1e7).toFixed(1) + " crore");
  setHTML("ex-as-share", ((100 * totW) / allW).toFixed(1) + "%");
  setHTML("ex-as-top", `${rows[0].label.toLowerCase()} (${(rows[0].wk / 1e5).toFixed(1)} lakh)`);
  setHTML("ex-as-est", ((AS[asKey("establishments", "trading")].data[asY] + AS[asKey("establishments", "other_services_group")].data[asY]) / 1e7).toFixed(1) + " crore");
  wirePlate("cb-asize", plot, "india-atlas_informal-service-enterprises-workers", csvOf(["activity", "establishments", "workers", "survey_year"], rows.map((r) => [r.label, r.est, r.wk, asFy])));
}
{
  // GVA per worker by activity, rural and urban, against the all-activities figure
  const rows = ACTS.flatMap(([a, l]) => ["rural", "urban"].map((s) => ({ label: l, sector: s, v: AS[asKey("gva_per_worker", a, s)]?.data[asY] }))).filter((r) => r.v != null);
  const order = ACTS.map(([a, l]) => ({ l, v: AS[asKey("gva_per_worker", a, "combined")]?.data[asY] })).filter((r) => r.v != null).sort((p, q) => q.v - p.v).map((r) => r.l);
  const allU = AS[asKey("gva_per_worker", "all_activities", "urban")].data[asY], allR = AS[asKey("gva_per_worker", "all_activities", "rural")].data[asY];
  const ur = rows.filter((r) => r.sector === "urban" && order.includes(r.label));
  const xMax = Math.ceil(Math.max(...rows.map((r) => r.v)) / 1e5) * 1e5;
  const plot = Plot.plot({
    width: W, height: 50 + order.length * 28, marginLeft: 330, marginRight: 90, marginTop: 34, marginBottom: 30, style: baseStyle,
    x: { label: null, domain: [0, xMax], tickFormat: (d) => "₹" + (d / 1e5).toFixed(0) + " lakh", tickSize: 0 },
    y: { label: null, domain: order, tickSize: 0, tickPadding: 12 },
    marks: [
      Plot.gridX({ stroke: GRID }),
      Plot.ruleX([allU], { stroke: ACC, strokeDasharray: "3 3", strokeOpacity: 0.5 }),
      Plot.text([{ x: allU }], { x: "x", frameAnchor: "top", text: () => `All activities, urban ₹${fmt.inr(allU)}`, dy: -20, textAnchor: "middle", fill: INK, fontSize: 11.5 }),
      Plot.link(order.map((l) => ({ l, a: rows.find((r) => r.label === l && r.sector === "rural")?.v, b: rows.find((r) => r.label === l && r.sector === "urban")?.v })).filter((d) => d.a != null && d.b != null), { y1: "l", y2: "l", x1: "a", x2: "b", stroke: "#DFE2E8", strokeWidth: 2 }),
      Plot.dot(rows.filter((r) => r.sector === "rural" && order.includes(r.label)), { y: "label", x: "v", r: 4, fill: "#fff", stroke: MUTED, strokeWidth: 1.5 }),
      Plot.dot(ur, { y: "label", x: "v", r: 4.5, fill: ACC }),
      Plot.text(order.map((l) => ({ l, v: Math.max(...rows.filter((r) => r.label === l).map((r) => r.v)) })), { y: "l", x: "v", text: (d) => "₹" + (d.v / 1e5).toFixed(1) + " lakh", dx: 10, textAnchor: "start", fill: INK, fontSize: 11.5 }),
    ],
  });
  a11y(plot, "GVA per worker in informal service enterprises", `In ${asFy}, urban ${order[0]} produced the most per worker; all activities, urban, ₹${fmt.inr(allU)} a year, rural ₹${fmt.inr(allR)}.`);
  mount("plot-agva", plot);
  setHTML("agva-fy", asFy);
  setHTML("pv-agva", "₹" + fmt.inr(AS[asKey("gva_per_worker", "other_services_group", "combined")].data[asY]));
  setHTML("ex-ag-fy", asFy);
  setHTML("ex-ag-svc", "₹" + fmt.inr(AS[asKey("gva_per_worker", "other_services_group", "combined")].data[asY]));
  setHTML("ex-ag-tr", "₹" + fmt.inr(AS[asKey("gva_per_worker", "trading", "combined")].data[asY]));
  setHTML("ex-ag-mo", "₹" + fmt.inr(Math.round(AS[asKey("gva_per_worker", "other_services_group", "combined")].data[asY] / 12)));
  setHTML("ex-ag-u", "₹" + fmt.inr(allU));
  setHTML("ex-ag-r", "₹" + fmt.inr(allR));
  wirePlate("cb-agva", plot, "india-atlas_informal-services-gva-per-worker", csvOf(["activity", "sector", "gva_per_worker_inr_per_year", "survey_year"], rows.map((r) => [r.label, r.sector, r.v, asFy])));
}

{
  // where the business is run: home, shop, stall or street (per 1,000 establishments, shown as %)
  const LOC = [["within_household_premises", "At home", "#5F6675"], ["outside_household_premises_with_fixed_premises_of_permanent_structure", "Shop or office", ACC],
    ["outside_household_premises_with_fixed_premises_of_temporary_structure_kiosk_stall", "Kiosk or stall", "#8F9FEC"], ["outside_household_premises_with_fixed_premises_but_without_any_structure", "Fixed spot, no structure", "#C3CDF7"],
    ["no_fixed", "No fixed place: hawkers, mobile", GOLD]];
  const val = (loc, act) => {
    if (loc === "no_fixed") { const a = AP[`location__outside_household_premises_without_fixed_premises_like_mobile_market__${act}__combined__all`]?.data[asY], b = AP[`location__outside_household_premises_without_fixed_premises_like_street_vendors_etc__${act}__combined__all`]?.data[asY]; return a == null && b == null ? null : ((a ?? 0) + (b ?? 0)) / 10; }
    const v = AP[`location__${loc}__${act}__combined__all`]?.data[asY]; return v == null ? null : v / 10;
  };
  const acts = [...ACTS, ["all_activities", "All activities, including manufacturing"]];
  const rows = acts.flatMap(([a, l]) => LOC.map(([k, kl, c]) => ({ label: l, loc: kl, color: c, v: val(k, a) }))).filter((r) => r.v != null);
  const order = acts.map(([a, l]) => ({ l, home: val("within_household_premises", a) ?? 0 })).sort((p, q) => q.home - p.home).map((r) => r.l);
  const plot = Plot.plot({
    width: W, height: 60 + order.length * 28, marginLeft: 330, marginRight: 40, marginTop: 30, marginBottom: 30, style: baseStyle,
    x: { label: null, domain: [0, 100], ticks: [0, 25, 50, 75, 100], tickFormat: (d) => d + "%", tickSize: 0 },
    y: { label: null, domain: order, tickSize: 0, tickPadding: 12 },
    color: { domain: LOC.map((l) => l[1]), range: LOC.map((l) => l[2]) },
    marks: [
      Plot.barX(rows, Plot.stackX({ y: "label", x: "v", fill: "loc", order: LOC.map((l) => l[1]), insetTop: 5, insetBottom: 5 })),
      Plot.text(rows, Plot.stackX({ y: "label", x: "v", z: "loc", order: LOC.map((l) => l[1]), text: (d) => (d.v >= 9 ? d.v.toFixed(0) + "%" : ""), fill: (d) => (d.color === "#C3CDF7" || d.color === "#8F9FEC" ? INK : "#fff"), fontSize: 11, className: "on-fill" })),
    ],
  });
  const home = (a) => val("within_household_premises", a);
  a11y(plot, "Where informal service businesses operate", `In ${asFy}, ${home("other_community_social_and_personal_service_activities").toFixed(1)}% of personal-service establishments ran from home; ${val("no_fixed", "other_retail_trade").toFixed(1)}% of retail shops had no fixed place.`);
  mount("plot-awhere", plot);
  setHTML("lg-awhere", LOC.map(([, l, c]) => `<button class="chip"><i style="background:${c}"></i>${l}</button>`).join(""));
  setHTML("awhere-fy", asFy);
  setHTML("pv-awhere", home("other_services_group").toFixed(1) + "%");
  setHTML("ex-aw-fy", asFy);
  setHTML("ex-aw-svc", home("other_services_group").toFixed(1) + "%");
  setHTML("ex-aw-ret", val("no_fixed", "other_retail_trade").toFixed(1) + "%");
  setHTML("ex-aw-pers", home("other_community_social_and_personal_service_activities").toFixed(1) + "%");
  setHTML("ex-aw-edu", home("education").toFixed(1) + "%");
  wirePlate("cb-awhere", plot, "india-atlas_informal-services-where-they-operate", csvOf(["activity", "location", "share_of_establishments_pct", "survey_year"], rows.map((r) => [r.label, r.loc, r.v, asFy])));
}

/* ======================== provenance ======================== */
setHTML("prov-vintage", share22.meta.vintage);
setHTML("prov-vintage2", share22.meta.vintage);
setHTML("prov-trade-v", bopQ.meta.vintage);
