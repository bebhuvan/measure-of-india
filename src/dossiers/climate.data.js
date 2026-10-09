// src/dossiers/climate.data.js: the climate guide's numbers, derived at build time.
//
// The guide draws on 62 bundles (about 12 MB); a page may not ship that. This module
// reads the bundles in Node when the page is built and keeps only what the plates draw
// and the copy names. The page embeds the result as JSON; climate.client.js draws from
// it; scripts/qc.mjs recomputes the rendered figures from the bundles independently.
//
// Every derived number is arithmetic on published values, stated where it is shown:
//   - "change" between two periods is the difference of the two periods' means, computed
//     inside one instrument (never CRU against ERA5, never ERA5 against CMIP6);
//   - anomalies on the century plate are each series against its own 1951-1980 mean;
//   - shares are OWID's own columns where OWID publishes one.
// The comparison windows are named once here and quoted by the page.

import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const cache = new Map();
export const B = (slug) => cache.get(slug) ?? cache.set(slug, JSON.parse(fs.readFileSync(path.join(ROOT, "data/series", slug + ".json"), "utf8"))).get(slug);

export const WIN = { base: [1951, 1980], recent: [1996, 2025], early: [1901, 1930], decade: [2016, 2025] };
const yr = (d) => +d.slice(0, 4);
const mean = (a) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : null);
export const r2 = (v) => (v == null ? null : Math.round(v * 100) / 100);
const r1 = (v) => (v == null ? null : Math.round(v * 10) / 10);
// mean of a series over [y0, y1] (inclusive), optionally one calendar month
export function wmean(b, k, [y0, y1], month = null) {
  const s = b.series[k];
  if (!s) return null;
  const v = b.dates.map((d, i) => (yr(d) >= y0 && yr(d) <= y1 && (month == null || +d.slice(5, 7) === month) ? s.data[i] : null)).filter((x) => x != null);
  return mean(v);
}
export const change = (b, k, w0 = WIN.base, w1 = WIN.recent, month = null) => {
  const a = wmean(b, k, w0, month), c = wmean(b, k, w1, month);
  return a == null || c == null ? null : c - a;
};
// least-squares slope, per decade
export function perDecade(b, k, y0, y1 = 9999) {
  const p = b.dates.map((d, i) => [yr(d), b.series[k].data[i]]).filter(([y, v]) => y >= y0 && y <= y1 && v != null);
  const mx = mean(p.map((x) => x[0])), my = mean(p.map((x) => x[1]));
  return 10 * p.reduce((s, [x, y]) => s + (x - mx) * (y - my), 0) / p.reduce((s, [x]) => s + (x - mx) ** 2, 0);
}
const pairs = (b, k, y0 = -Infinity) => b.dates.map((d, i) => [yr(d), b.series[k]?.data[i] ?? null]).filter(([y, v]) => y >= y0 && v != null);
const lastOf = (b, k) => { const s = b.series[k].data; for (let i = s.length - 1; i >= 0; i--) if (s[i] != null) return { y: yr(b.dates[i]), d: b.dates[i], v: s[i] }; return null; };
const at = (b, k, y) => b.series[k]?.data[b.dates.indexOf(`${y}-01-01`)] ?? null;

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTHS_FULL = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

// the state key -> display name map, from CCKP's own labels ("..., Andhra Pradesh")
function stateNames(b, prefix) {
  const out = {};
  for (const [k, s] of Object.entries(b.series)) if (k.startsWith(prefix + "__")) out[k.slice(prefix.length + 2)] = s.label.split(", ").at(-1);
  return out;
}

export function climateData() {
  /* ---------- the month (OWID ERA5) ---------- */
  const TM = B("climate-temp-monthly"), an = TM.series.temperature_anomaly.data, t2 = TM.series.temperature_2m.data;
  const L = TM.dates.length - 1, lastD = TM.dates[L], mo = +lastD.slice(5, 7), lyr = yr(lastD);
  const same = TM.dates.map((d, i) => ({ y: yr(d), v: an[i] })).filter((x, i) => +TM.dates[i].slice(5, 7) === mo && x.v != null).sort((a, b) => b.v - a.v);
  const ytd = TM.dates.map((d, i) => (yr(d) === lyr ? an[i] : null)).filter((v) => v != null);
  const month = {
    label: `${MONTHS_FULL[mo - 1]} ${lyr}`, short: `${MONTHS[mo - 1]} ${lyr}`, monthName: MONTHS_FULL[mo - 1],
    anom: an[L], temp: t2[L], prev: an[L - 1], prevLabel: `${MONTHS_FULL[(mo + 10) % 12]}`, yearAgo: an[L - 12],
    rank: same.findIndex((x) => x.y === lyr) + 1, of: same.length, warmest: same[0], coolest: same.at(-1),
    last12: mean(an.slice(-12)), ytdN: ytd.length, ytdAbove: ytd.filter((v) => v > 0).length, ytdMean: mean(ytd),
  };
  const stripes = TM.dates.map((d, i) => [yr(d), +d.slice(5, 7), an[i] == null ? null : r2(an[i])]).filter((x) => x[2] != null);

  /* ---------- the century (CRU, and ERA5 beside it) ---------- */
  const CRU = B("climate-cru"), E5 = B("climate-era5-temp");
  const cruBase = wmean(CRU, "tas", WIN.base), e5Base = wmean(E5, "tas", WIN.base);
  const century = {
    cru: pairs(CRU, "tas").map(([y, v]) => [y, r2(v - cruBase)]),
    era5: pairs(E5, "tas").map(([y, v]) => [y, r2(v - e5Base)]),
    cruLast: lastOf(CRU, "tas").y, era5Last: lastOf(E5, "tas").y,
    change: change(CRU, "tas", WIN.early, WIN.decade), changeBase: change(CRU, "tas", WIN.base, WIN.recent),
    era5ChangeBase: change(E5, "tas", WIN.base, WIN.recent),
    rate1901: perDecade(CRU, "tas", 1901), rate1976: perDecade(CRU, "tas", 1976), rate1976era5: perDecade(E5, "tas", 1976),
    warmest: pairs(CRU, "tas").sort((a, b) => b[1] - a[1]).slice(0, 5).map(([y]) => y),
    early: wmean(CRU, "tas", WIN.early), decade: wmean(CRU, "tas", WIN.decade),
  };

  /* ---------- months and hours (CRU monthly) ---------- */
  const CM = B("climate-cru-monthly");
  const months = MONTHS.map((m, i) => ({ m, tas: r2(change(CM, "tas", WIN.base, WIN.recent, i + 1)), tmax: r2(change(CM, "tasmax", WIN.base, WIN.recent, i + 1)), tmin: r2(change(CM, "tasmin", WIN.base, WIN.recent, i + 1)) }));
  const dayNight = { tmax: change(CRU, "tasmax"), tmin: change(CRU, "tasmin"), tas: change(CRU, "tas") };

  /* ---------- humid heat and hot nights (ERA5 India) ---------- */
  const H = B("climate-era5-hotdays"), HS = B("climate-era5-heatstress"), EN = B("climate-era5-energy");
  const panel = (b, k, label) => ({ k, label, data: pairs(b, k).map(([y, v]) => [y, r1(v)]), base: wmean(b, k, WIN.base), recent: wmean(b, k, WIN.recent), last: lastOf(b, k) });
  const heat = [panel(H, "hd40", "Days of 40°C or more"), panel(H, "tr26", "Nights of 26°C or more"), panel(HS, "wbt27", "Days with a wet-bulb temperature of 27°C or more"), panel(HS, "hi41", "Days with a heat index of 41°C or more")];
  const heatMore = { hd35: panel(H, "hd35", ""), wbt29: panel(HS, "wbt29", ""), hi35: panel(HS, "hi35", ""), wsdi: panel(B("climate-era5-temp"), "wsdi", ""), txx: panel(B("climate-era5-temp"), "txx", "") };

  /* ---------- states (ERA5 annual, CCKP units) ---------- */
  const ST = B("climate-era5-states-temp"), SH = B("climate-era5-states-hotdays"), SS = B("climate-era5-states-heatstress"), SR = B("climate-era5-states-rain");
  const CRS = B("climate-cru-states");
  const names = stateNames(ST, "tas");
  const states = Object.entries(names).map(([k, name]) => {
    const prBase = wmean(CRS, `pr__${k}`, WIN.base);
    return {
      k, name,
      tas: r2(change(ST, `tas__${k}`)), tmax: r2(change(ST, `tasmax__${k}`)), tmin: r2(change(ST, `tasmin__${k}`)),
      tasCru: r2(change(CRS, `tas__${k}`)),
      hd40: r1(change(SH, `hd40__${k}`)), hd40now: r1(wmean(SH, `hd40__${k}`, WIN.recent)),
      tr26: r1(change(SH, `tr26__${k}`)), wbt27: r1(change(SS, `wbt27__${k}`)), wbt27now: r1(wmean(SS, `wbt27__${k}`, WIN.recent)),
      hi41now: r1(wmean(SS, `hi41__${k}`, WIN.recent)),
      prCru: prBase ? r1((100 * change(CRS, `pr__${k}`)) / prBase) : null,
      pr: r1((100 * change(SR, `pr__${k}`)) / wmean(SR, `pr__${k}`, WIN.base)),
      proj: null,
    };
  });
  const SP = B("climate-cmip6-states-temp"), SPH = B("climate-cmip6-states-hotdays"), SPS = B("climate-cmip6-states-heatstress");
  const i2040 = SP.dates.indexOf("2040-01-01"), i2080 = SP.dates.indexOf("2080-01-01");
  for (const s of states) {
    s.proj = r2(SP.series[`tas__ssp245__${s.k}`]?.data[i2040] ?? null);
    s.proj85 = r2(SP.series[`tas__ssp585__${s.k}`]?.data[i2080] ?? null);
    s.projTr26 = r1(SPH.series[`tr26__ssp245__${s.k}`]?.data[i2040] ?? null);
    s.projWbt27 = r1(SPS.series[`wbt27__ssp245__${s.k}`]?.data[i2040] ?? null);
  }

  /* ---------- the monsoon ---------- */
  const R = B("climate-era5-rain");
  const jjas = {};
  CM.dates.forEach((d, i) => { const y = yr(d), m = +d.slice(5, 7), v = CM.series.pr.data[i]; if (v == null) return; jjas[y] ??= { all: 0, mon: 0, n: 0 }; jjas[y].all += v; jjas[y].n++; if (m >= 6 && m <= 9) jjas[y].mon += v; });
  const rain = {
    annual: pairs(CRU, "pr").map(([y, v]) => [y, Math.round(v)]),
    base: wmean(CRU, "pr", WIN.base), recent: wmean(CRU, "pr", WIN.recent), early: wmean(CRU, "pr", WIN.early),
    jjasShare: Object.entries(jjas).filter(([, o]) => o.n === 12).map(([y, o]) => [+y, r1((100 * o.mon) / o.all)]),
    months: MONTHS.map((m, i) => ({ m, base: Math.round(wmean(CM, "pr", WIN.base, i + 1)), recent: Math.round(wmean(CM, "pr", WIN.recent, i + 1)) })),
    driest: pairs(CRU, "pr").sort((a, b) => a[1] - b[1]).slice(0, 5),
    extremes: [panel(R, "rx5day", "Wettest five days of the year, mm"), panel(R, "r99ptot", "Share of the year's rain falling on the wettest 1% of days, %"), panel(R, "r50mm", "Days with 50 mm of rain or more"), panel(R, "cdd", "Longest dry spell, days")],
  };
  rain.jjasBase = mean(rain.jjasShare.filter(([y]) => y >= 1951 && y <= 1980).map((x) => x[1]));
  rain.jjasRecent = mean(rain.jjasShare.filter(([y]) => y >= 1996 && y <= 2025).map((x) => x[1]));

  /* ---------- emissions (OWID; one bundle per geography) ---------- */
  const G = { IND: B("climate-co2"), CHN: B("climate-co2-chn"), USA: B("climate-co2-usa"), WLD: B("climate-co2-world") };
  const co2Last = lastOf(G.IND, "co2").y;
  const em = {
    year: co2Last,
    total: Object.fromEntries(["IND", "CHN", "USA"].map((g) => [g, pairs(G[g], "co2", 1950).map(([y, v]) => [y, Math.round(v)])])),
    pc: Object.fromEntries(Object.keys(G).map((g) => [g, pairs(G[g], "co2_per_capita", 1950).map(([y, v]) => [y, r2(v)])])),
    fuels: ["coal_co2", "oil_co2", "gas_co2", "cement_co2", "flaring_co2"].map((k) => ({ k, data: pairs(G.IND, k, 1950).map(([y, v]) => [y, Math.round(v)]) })),
    share: Object.fromEntries(["IND", "CHN", "USA"].map((g) => [g, { annual: at(G[g], "share_global_co2", co2Last), cumulative: at(G[g], "share_global_cumulative_co2", co2Last), warming: at(G[g], "share_of_temperature_change_from_ghg", co2Last), pc: at(G[g], "co2_per_capita", co2Last), pop: at(G[g], "population", co2Last) }])),
    worldPc: at(G.WLD, "co2_per_capita", co2Last), worldTotal: at(G.WLD, "co2", co2Last),
    india: { co2: at(G.IND, "co2", co2Last), growth: at(G.IND, "co2_growth_prct", co2Last), ghg: at(G.IND, "total_ghg", co2Last), methane: at(G.IND, "methane", co2Last), n2o: at(G.IND, "nitrous_oxide", co2Last), coal: at(G.IND, "coal_co2", co2Last), co2_1990: at(G.IND, "co2", 1990), luc: at(G.IND, "land_use_change_co2", co2Last), warmingC: at(G.IND, "temperature_change_from_ghg", co2Last) },
    consumption: { terr: pairs(G.IND, "co2", 1990).map(([y, v]) => [y, Math.round(v)]), cons: pairs(G.IND, "consumption_co2", 1990).map(([y, v]) => [y, Math.round(v)]), last: lastOf(G.IND, "consumption_co2") },
    gases: ["co2_including_luc", "methane", "nitrous_oxide"].map((k) => ({ k, data: pairs(G.IND, k, 1950).map(([y, v]) => [y, Math.round(v)]) })),
  };
  em.india.coalShare = (100 * em.india.coal) / em.india.co2;
  em.consumption.terrAt = at(G.IND, "co2", em.consumption.last.y);

  /* ---------- energy (OWID) ---------- */
  const EG = B("climate-energy");
  const enLast = lastOf(EG, "coal_share_energy").y, elLast = lastOf(EG, "coal_share_elec").y;
  const energy = {
    year: enLast, elYear: elLast,
    primary: ["coal", "oil", "gas", "nuclear", "hydro", "solar", "wind", "biofuel", "other_renewables"].map((f) => ({ f, data: pairs(EG, `${f}_share_energy`, 1965).map(([y, v]) => [y, r1(v)]), last: at(EG, `${f}_share_energy`, enLast) })),
    elec: ["coal", "gas", "oil", "nuclear", "hydro", "solar", "wind", "biofuel", "other_renewables"].map((f) => ({ f, data: pairs(EG, `${f}_share_elec`, 1985).map(([y, v]) => [y, r1(v)]), last: at(EG, `${f}_share_elec`, elLast) })),
    intensity: { last: at(EG, "carbon_intensity_elec", elLast) ?? lastOf(EG, "carbon_intensity_elec")?.v, y: lastOf(EG, "carbon_intensity_elec")?.y, first: pairs(EG, "carbon_intensity_elec")[0] },
    perCapitaElec: { last: lastOf(EG, "per_capita_electricity"), y2000: at(EG, "per_capita_electricity", 2000), series: pairs(EG, "per_capita_electricity", 1985).map(([y, v]) => [y, Math.round(v)]) },
    lowCarbonElec: at(EG, "low_carbon_share_elec", elLast), fossilEnergy: at(EG, "fossil_share_energy", enLast),
  };

  /* ---------- projections (CMIP6; never joined to observations) ---------- */
  const W = B("climate-cmip6-windows-temp"), WH = B("climate-cmip6-windows-hotdays"), WS = B("climate-cmip6-windows-heatstress"), WE = B("climate-cmip6-windows-energy");
  const SSPS = ["ssp126", "ssp245", "ssp370", "ssp585"];
  const WINS = W.dates.filter((d) => d !== "1995-01-01").map((d) => yr(d));
  const wval = (b, k, y) => b.series[k]?.data[b.dates.indexOf(`${y}-01-01`)] ?? null;
  const proj = {
    windows: WINS,
    tas: SSPS.map((s) => ({ s, w: WINS.map((y) => ({ y, med: r2(wval(W, `tas__change__${s}__median`, y)), p10: r2(wval(W, `tas__change__${s}__p10`, y)), p90: r2(wval(W, `tas__change__${s}__p90`, y)) })) })),
    days: [["tr26", WH, "Nights of 26°C or more"], ["hd40", WH, "Days of 40°C or more"], ["hi41", WS, "Days with a heat index of 41°C or more"]].map(([k, b, label]) => ({
      k, label, ref: r1(wval(b, `${k}__level__historical__median`, 1995)),
      s: ["ssp245", "ssp585"].map((s) => ({ s, w: WINS.map((y) => ({ y, med: r1(wval(b, `${k}__level__${s}__median`, y)), p10: r1(wval(b, `${k}__level__${s}__p10`, y)), p90: r1(wval(b, `${k}__level__${s}__p90`, y)) })) })),
    })),
    cdd65: { ref: wval(WE, "cdd65__level__historical__median", 1995), s: ["ssp245", "ssp585"].map((s) => ({ s, w: WINS.map((y) => ({ y, med: wval(WE, `cdd65__level__${s}__median`, y) })) })) },
  };

  /* ---------- the cost of heat ---------- */
  const HD = B("climate-heat-deaths"), BA = B("climate-burned-area");
  const cost = {
    cdd: pairs(EN, "cdd65").map(([y, v]) => [y, Math.round(v)]), cddBase: wmean(EN, "cdd65", WIN.base), cddRecent: wmean(EN, "cdd65", WIN.recent),
    heatDeaths: HD.dates.map((d, i) => [yr(d), r1(HD.series.heat_death_rate.data[i])]),
    fires: Object.entries(BA.series).filter(([k]) => k !== "all").map(([k, s]) => ({ k, label: s.label, data: BA.dates.map((d, i) => [yr(d), s.data[i]]).filter(([, v]) => v != null) })),
    firesAll: pairs(BA, "all"), firesCrop: pairs(BA, "croplands"),
  };

  return { WIN, month, stripes, century, months, dayNight, heat, heatMore, states, rain, em, energy, proj, cost };
}
