// Design-phase deterministic generators, extracted verbatim from
// site/dossiers/cpi.html and site/dossiers/gdp.html. Used only with --mock.

const mulberry = (a) => () => {
  a |= 0; a = (a + 0x6d2b79f5) | 0;
  let t = Math.imul(a ^ (a >>> 15), 1 | a);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const anchor = (p) => (m) => {
  if (m <= p[0][0]) return p[0][1];
  for (let i = 1; i < p.length; i++)
    if (m <= p[i][0]) {
      const [a, b] = p[i - 1], [c, d] = p[i];
      return b + ((d - b) * (m - a)) / (c - a);
    }
  return p[p.length - 1][1];
};
const series = (seed, anchors, step, persist, n, y0, perYr) => {
  const R = mulberry(seed);
  const fn = anchor(anchors);
  const out = []; let dev = 0;
  for (let i = 0; i < n; i++) { dev = dev * persist + (R() - 0.5) * 2 * step; out.push(+(fn(i) + dev).toFixed(2)); }
  const dates = [];
  for (let i = 0; i < n; i++) dates.push(new Date(Date.UTC(y0 + Math.floor(i / perYr), Math.round((i % perYr) * 12 / perYr), 1)).toISOString().slice(0, 10));
  return { dates, data: out };
};

export function mockCpi() {
  const R = mulberry(20251231);
  const FOOD = anchor([[0,6.1],[6,7.2],[12,1.9],[17,-1.8],[23,0.7],[24,-0.1],[30,0.9],[36,-2.6],[42,1.9],[44,4.8],[45,8.2],[46,11.6],[47,13.6],[48,13.0],[49,11.0],[50,8.6],[51,6.6],[52,5.0],[58,9.6],[59,6.0],[60,3.2],[64,4.0],[70,0.7],[72,2.8],[74,5.6],[76,8.6],[82,4.2],[88,8.4],[90,8.3],[93,11.5],[96,9.5],[100,6.5],[102,7.8],[103,9.0],[104,10.2],[105,10.9],[108,8.4],[112,5.9],[116,3.8],[119,2.9]]);
  const FUEL = anchor([[0,5.3],[6,3.4],[12,3.8],[18,6.2],[24,7.9],[30,4.4],[36,-1.6],[42,1.6],[48,3.5],[54,2.7],[57,5.0],[58,7.0],[60,10.0],[66,12.7],[72,13.3],[78,8.5],[84,11.0],[90,7.4],[96,1.0],[102,-1.0],[106,-3.7],[110,-5.3],[114,-1.5],[119,2.6]]);
  const CORE = anchor([[0,4.9],[12,4.6],[18,4.1],[24,5.7],[30,6.3],[36,5.5],[42,3.8],[48,4.4],[54,5.6],[60,5.4],[66,6.2],[72,6.3],[78,6.0],[84,6.2],[90,5.4],[96,4.6],[102,3.9],[106,3.5],[110,3.7],[114,4.1],[119,4.2]]);
  const N = 120;
  const dates = [];
  for (let i = 0; i < N; i++) dates.push(new Date(Date.UTC(2016 + Math.floor(i / 12), i % 12, 1)).toISOString().slice(0, 10));
  const mk = (fn, step, persist) => {
    const out = []; let dev = 0;
    for (let i = 0; i < N; i++) { dev = dev * persist + (R() - 0.5) * 2 * step; out.push(+(fn(i) + dev).toFixed(2)); }
    return out;
  };
  const food = mk(FOOD, 0.12, 0.8), fuel = mk(FUEL, 0.07, 0.75), core = mk(CORE, 0.03, 0.85);
  const headline = [];
  for (let i = 0; i < N; i++) headline.push(+(0.4586 * food[i] + 0.0684 * fuel[i] + 0.4729 * core[i]).toFixed(2));
  return {
    dates,
    series: {
      headline: { name: "headline_cpi_yoy_pct", label: "Headline", color: "#BE3E26", data: headline },
      food: { name: "food_beverages_yoy_pct", label: "Food", color: "#5B564B", data: food },
      fuel: { name: "fuel_light_yoy_pct", label: "Fuel", color: "#A8A293", data: fuel },
      core: { name: "core_yoy_pct", label: "Core", color: "#C6C0B0", data: core },
    },
  };
}

export function mockGdp() {
  const R = mulberry(20251128);
  const GDP = anchor([[0,8.2],[2,7.9],[3,6.6],[4,7.6],[6,6.2],[8,7.0],[10,6.5],[12,5.6],[13,4.4],[14,3.9],[15,3.0],[16,-23.8],[17,-6.6],[18,0.5],[19,1.6],[20,20.1],[21,8.4],[22,5.5],[23,4.3],[24,13.1],[25,6.2],[26,4.4],[27,6.1],[28,7.8],[29,8.2],[30,6.5],[31,7.6],[32,8.4],[33,7.8],[34,6.7],[35,6.5],[36,5.6],[37,6.2],[38,6.9]]);
  const GVA = anchor([[0,7.8],[2,7.5],[3,6.4],[4,7.2],[6,6.0],[8,6.9],[10,6.2],[12,5.4],[13,4.1],[15,2.7],[16,-22.4],[17,-5.9],[18,0.9],[19,1.2],[20,18.8],[21,7.9],[22,4.9],[23,3.8],[24,11.9],[25,5.7],[26,4.0],[27,5.9],[28,7.2],[29,7.7],[30,6.2],[31,7.2],[32,8.0],[33,7.3],[34,6.3],[35,6.2],[36,5.5],[37,6.0],[38,6.6]]);
  const PFCE = anchor([[0,8.5],[2,8.0],[3,7.2],[4,8.1],[6,7.0],[8,7.4],[10,6.8],[12,5.9],[13,4.6],[15,2.8],[16,-22.9],[17,-7.4],[18,0.8],[19,3.5],[20,19.3],[21,10.2],[22,9.8],[23,4.9],[24,9.9],[25,5.9],[26,2.8],[27,4.0],[28,5.5],[29,8.3],[30,3.1],[31,7.4],[32,5.6],[33,4.0],[34,7.4],[35,6.0],[36,7.0],[37,6.8],[38,7.2]]);
  const GFCF = anchor([[0,6.1],[2,8.0],[4,9.5],[6,7.2],[8,10.2],[10,7.5],[12,6.1],[13,4.5],[15,2.1],[16,-47.1],[17,-7.9],[18,3.1],[19,5.2],[20,55.3],[21,20.4],[22,9.6],[23,6.5],[24,20.6],[25,9.8],[26,5.3],[27,8.0],[28,8.5],[29,8.0],[30,6.5],[31,11.6],[32,9.8],[33,7.6],[34,6.7],[35,6.5],[36,7.5],[37,6.8],[38,7.4]]);
  const N = 39;
  const dates = [];
  for (let i = 0; i < N; i++) dates.push(new Date(Date.UTC(2016 + Math.floor(i / 4), (i % 4) * 3, 1)).toISOString().slice(0, 10));
  const mk = (fn, step, persist) => {
    const out = []; let dev = 0;
    for (let i = 0; i < N; i++) { dev = dev * persist + (R() - 0.5) * 2 * step; out.push(+(fn(i) + dev).toFixed(2)); }
    return out;
  };
  return {
    dates,
    series: {
      gdp: { name: "gdp_real_yoy_pct", label: "GDP", color: "#BE3E26", data: mk(GDP, 0.04, 0.7) },
      gva: { name: "gva_real_yoy_pct", label: "GVA", color: "#5B564B", data: mk(GVA, 0.04, 0.7) },
      pfce: { name: "pfce_real_yoy_pct", label: "Consumption", color: "#A8A293", data: mk(PFCE, 0.08, 0.75) },
      gfcf: { name: "gfcf_real_yoy_pct", label: "Investment", color: "#8A857A", data: mk(GFCF, 0.15, 0.75) },
    },
  };
}

export function mockWpi() {
  const N = 120;
  const primary = series(20260114, [[0,3.2],[12,6.8],[24,1.4],[36,4.9],[48,2.1],[60,5.6],[72,10.4],[78,14.1],[84,8.2],[90,3.4],[96,1.1],[102,6.8],[108,9.4],[114,2.6],[119,1.8]], 0.15, 0.8, N, 2016, 12);
  const fuel = series(20260115, [[0,-4.1],[12,-9.8],[24,2.6],[36,8.4],[48,-2.2],[60,6.1],[72,18.6],[78,32.4],[84,24.1],[90,6.4],[96,-1.2],[102,2.8],[108,4.6],[114,-2.4],[119,0.8]], 0.2, 0.75, N, 2016, 12);
  const mfg = series(20260116, [[0,1.4],[12,2.2],[24,2.8],[36,3.6],[48,2.4],[60,1.8],[72,4.2],[78,9.6],[84,12.4],[90,8.1],[96,4.2],[102,2.4],[108,1.6],[114,1.2],[119,1.4]], 0.05, 0.85, N, 2016, 12);
  const headline = primary.data.map((_, i) => +(0.2262 * primary.data[i] + 0.1315 * fuel.data[i] + 0.6423 * mfg.data[i]).toFixed(2));
  const food = series(20260117, [[0,4.6],[12,7.4],[24,2.1],[36,5.8],[48,3.2],[60,6.4],[72,11.8],[78,15.6],[84,9.4],[90,4.1],[96,1.8],[102,7.6],[108,10.8],[114,3.4],[119,2.2]], 0.14, 0.8, N, 2016, 12);
  return {
    dates: primary.dates,
    series: {
      headline: { name: "headline_wpi_yoy_pct", label: "Headline", color: "#BE3E26", data: headline },
      primary: { name: "primary_articles_yoy_pct", label: "Primary", color: "#5B564B", data: primary.data },
      fuel: { name: "fuel_power_yoy_pct", label: "Fuel", color: "#A8A293", data: fuel.data },
      manufactured: { name: "manufactured_products_yoy_pct", label: "Manufactured", color: "#C6C0B0", data: mfg.data },
      food_index: { name: "wpi_food_index_yoy_pct", label: "Food index", color: "#8A857A", data: food.data },
    },
  };
}

export function mockCpialrl() {
  const old = series(20260132, [[0,6.2],[12,9.4],[24,4.1],[36,6.8],[48,3.2],[60,7.6],[72,10.2],[84,5.4],[96,6.1],[100,4.2]], 0.1, 0.8, 101, 2017, 12);
  const oldRl = series(20260133, [[0,6.3],[12,9.5],[24,4.2],[36,6.9],[48,3.3],[60,7.7],[72,10.3],[84,5.5],[96,6.2],[100,4.3]], 0.1, 0.8, 101, 2017, 12);
  const b86 = {
    dates: old.dates,
    series: {
      al: { name: "cpi_al_yoy_pct_base1986", label: "Agri labourers", color: "#BE3E26", data: old.data },
      rl: { name: "cpi_rl_yoy_pct_base1986", label: "Rural labourers", color: "#5B564B", data: oldRl.data },
    },
  };
  const lvl = series(20260134, [[0,130.1],[2,131.4],[4,133.2],[6,134.8],[8,135.6],[10,136.4],[11,136.9]], 0.1, 0.9, 12, 2025, 12);
  lvl.dates = lvl.dates.map((d) => new Date(new Date(d + "T00:00:00Z").setUTCMonth(new Date(d + "T00:00:00Z").getUTCMonth() + 5)).toISOString().slice(0, 10));
  const lvlRl = series(20260135, [[0,130.3],[2,131.6],[4,133.4],[6,135.0],[8,135.8],[10,136.5],[11,137.0]], 0.1, 0.9, 12, 2025, 12);
  const pub = series(20260136, [[0,5.2],[2,4.6],[4,3.8],[6,3.1],[8,2.4],[10,1.8],[11,1.6]], 0.05, 0.8, 12, 2025, 12);
  const pubRl = series(20260137, [[0,5.3],[2,4.7],[4,3.9],[6,3.2],[8,2.5],[10,1.9],[11,1.7]], 0.05, 0.8, 12, 2025, 12);
  const b19 = {
    dates: lvl.dates,
    series: {
      al: { name: "cpi_al_index_base2019", label: "Agri labourers", color: "#BE3E26", data: lvl.data, unit: "index" },
      rl: { name: "cpi_rl_index_base2019", label: "Rural labourers", color: "#5B564B", data: lvlRl.data, unit: "index" },
      al_published_yoy: { name: "cpi_al_yoy_pct_published", label: "AL inflation (published)", color: "#A8A293", data: pub.data, unit: "pct" },
      rl_published_yoy: { name: "cpi_rl_yoy_pct_published", label: "RL inflation (published)", color: "#C6C0B0", data: pubRl.data, unit: "pct" },
    },
  };
  return { b86, b19 };
}

export function mockCpialrlGroups() {
  const lvl = series(20260134, [[0,130.1],[2,131.4],[4,133.2],[6,134.8],[8,135.6],[10,136.4],[11,136.9]], 0.1, 0.9, 12, 2025, 12);
  const dates = lvl.dates.map((d) => new Date(new Date(d + "T00:00:00Z").setUTCMonth(new Date(d + "T00:00:00Z").getUTCMonth() + 5)).toISOString().slice(0, 10));
  const GREYS = ["#5B564B", "#8A857A", "#A8A293", "#C6C0B0"];
  const GROUPS = [["food", "Food", 138], ["pan_tobacco_and_intoxicants", "Pan, tobacco", 112], ["fuel_and_light", "Fuel & light", 118], ["clothing_and_footwear", "Clothing & footwear", 141], ["miscellaneous", "Miscellaneous", 152]];
  const out = { dates, series: {} };
  GROUPS.forEach(([k, label, base], i) => {
    const g = series(20260200 + i, [[0, base], [6, base * 1.03], [11, base * 1.05]], 0.05, 0.9, 12, 2025, 12);
    const p = series(20260210 + i, [[0, 4.8], [6, 3.4], [11, 2.1]], 0.03, 0.8, 12, 2025, 12);
    out.series[k] = { name: `cpi_al_${k}_index_base2019`, label, color: GREYS[i % GREYS.length], data: g.data, unit: "index" };
    out.series[`${k}_published_yoy`] = { name: `cpi_al_${k}_yoy_pct_published`, label: `${label} (published y/y)`, color: GREYS[(i + 2) % GREYS.length], data: p.data, unit: "pct" };
  });
  return out;
}

export function mockPlfs() {
  const m = series(20260415, [[0,7.4],[1,6.8],[2,7.1],[3,6.4],[4,5.8],[5,6.1],[6,5.2],[7,5.6],[8,5.1],[9,4.9],[10,5.2],[11,4.8],[12,5.1],[13,4.6],[14,5.0]], 0.05, 0.7, 15, 2025, 12);
  const ml = series(20260416, [[0,55.1],[1,55.4],[2,55.8],[3,56.2],[4,56.6],[5,57.1],[6,57.4],[7,57.0],[8,57.4],[9,57.8],[10,58.1],[11,57.6],[12,58.0],[13,58.4],[14,58.1]], 0.06, 0.7, 15, 2025, 12);
  const mw = series(20260417, [[0,51.0],[1,51.6],[2,51.8],[3,52.6],[4,53.3],[5,53.6],[6,54.4],[7,53.8],[8,54.5],[9,55.0],[10,55.1],[11,54.8],[12,55.0],[13,55.7],[14,55.2]], 0.06, 0.7, 15, 2025, 12);
  // monthly bulletin runs Apr 2025 onward — shift the generated Jan-based dates
  m.dates = m.dates.map((d) => new Date(new Date(d + "T00:00:00Z").setUTCMonth(new Date(d + "T00:00:00Z").getUTCMonth() + 3)).toISOString().slice(0, 10));
  const monthly = {
    dates: m.dates,
    series: {
      ur: { name: "unemployment_rate_pct", label: "Unemployment", color: "#BE3E26", data: m.data },
      lfpr: { name: "lfpr_pct", label: "Participation", color: "#5B564B", data: ml.data },
      wpr: { name: "wpr_pct", label: "Workers", color: "#A8A293", data: mw.data },
    },
  };
  const q = series(20260418, [[0,9.8],[2,9.1],[4,8.4],[6,7.6],[8,7.2],[10,6.8],[12,6.5],[14,6.4],[16,6.1],[18,5.8],[20,5.6],[22,5.4],[24,5.2],[26,5.1],[28,5.0],[30,4.9],[31,5.1]], 0.08, 0.7, 32, 2018, 4);
  const ql = series(20260419, [[0,49.4],[2,49.8],[4,50.2],[6,50.6],[8,51.0],[10,51.4],[12,51.8],[14,52.2],[16,52.6],[18,53.0],[20,53.4],[22,53.8],[24,54.2],[26,54.6],[28,55.0],[30,55.4],[31,55.6]], 0.08, 0.7, 32, 2018, 4);
  const qw = series(20260420, [[0,44.6],[2,45.3],[4,46.0],[6,46.8],[8,47.3],[10,47.9],[12,48.4],[14,48.9],[16,49.4],[18,49.9],[20,50.4],[22,50.9],[24,51.4],[26,51.8],[28,52.2],[30,52.7],[31,52.8]], 0.08, 0.7, 32, 2018, 4);
  const quarterly = {
    dates: q.dates,
    series: {
      ur: { name: "unemployment_rate_urban_pct", label: "Unemployment", color: "#BE3E26", data: q.data },
      lfpr: { name: "lfpr_urban_pct", label: "Participation", color: "#5B564B", data: ql.data },
      wpr: { name: "wpr_urban_pct", label: "Workers", color: "#A8A293", data: qw.data },
    },
  };
  return { monthly, quarterly };
}

export function mockGdpExp() {
  const N = 39;
  const gfce = series(20251129, [[0,6.4],[4,5.1],[8,6.8],[12,3.4],[16,3.1],[17,6.4],[18,9.2],[19,12.1],[20,7.4],[21,4.8],[22,3.2],[24,6.1],[28,4.2],[32,5.6],[36,4.8],[38,5.2]], 0.2, 0.7, N, 2016, 4);
  const exp = series(20251130, [[0,2.1],[4,5.4],[8,8.2],[12,4.6],[16,-36.4],[17,-18.2],[18,4.1],[19,32.6],[20,42.1],[21,18.4],[22,9.6],[24,14.2],[28,6.8],[32,4.4],[36,7.2],[38,6.1]], 0.4, 0.7, N, 2016, 4);
  const imp = series(20251201, [[0,1.4],[4,6.2],[8,10.4],[12,3.8],[16,-41.2],[17,-24.6],[18,2.4],[19,48.2],[20,52.4],[21,24.8],[22,12.6],[24,16.4],[28,8.2],[32,5.1],[36,8.4],[38,7.2]], 0.5, 0.7, N, 2016, 4);
  return {
    dates: gfce.dates,
    series: {
      gfce: { name: "gfce_real_yoy_pct", label: "Govt consumption", color: "#5B564B", data: gfce.data },
      exports: { name: "exports_real_yoy_pct", label: "Exports", color: "#A8A293", data: exp.data },
      imports: { name: "imports_real_yoy_pct", label: "Imports", color: "#C6C0B0", data: imp.data },
    },
  };
}

export function mockRbi() {
  const N = 120;
  const exp = series(20260201, [[0,23000],[12,26000],[24,24500],[36,29000],[48,26500],[52,21000],[54,14000],[56,29000],[60,35000],[72,33000],[84,42000],[96,36000],[108,40000],[119,43700]], 300, 0.7, N, 2016, 12);
  const imp = series(20260202, [[0,31000],[12,38000],[24,34000],[36,41000],[48,39000],[52,33000],[54,17000],[56,42000],[60,51000],[72,49000],[84,64000],[96,56000],[108,61000],[119,61400]], 400, 0.7, N, 2016, 12);
  const bal = exp.data.map((e, i) => +(e - imp.data[i]).toFixed(2));
  const trade = {
    dates: exp.dates,
    series: {
      exports: { name: "exports_usd_millions", label: "Exports", color: "#5B564B", data: exp.data, unit: "USD_millions" },
      imports: { name: "imports_usd_millions", label: "Imports", color: "#A8A293", data: imp.data, unit: "USD_millions" },
      balance: { name: "trade_balance_usd_millions", label: "Balance", color: "#BE3E26", data: bal, unit: "USD_millions" },
    },
  };
  const res = series(20260203, [[0,355000],[12,370000],[24,390000],[36,405000],[48,420000],[60,475000],[72,540000],[84,605000],[96,575000],[108,640000],[119,690000]], 1500, 0.85, N, 2016, 12);
  const fx = series(20260204, [[0,67.1],[12,68.4],[24,64.8],[36,71.2],[48,69.8],[54,74.4],[60,75.6],[72,73.1],[84,79.4],[96,82.6],[108,83.4],[119,86.1]], 0.15, 0.8, N, 2016, 12);
  const forex = {
    dates: res.dates,
    series: {
      reserves: { name: "forex_reserves_usd_millions", label: "Reserves", color: "#BE3E26", data: res.data, unit: "USD_millions" },
      usdinr: { name: "usdinr_monthly_avg", label: "USD/INR", color: "#5B564B", data: fx.data, unit: "inr_per_usd" },
    },
  };
  return { trade, forex };
}

export function mockRbiExtended() {
  const N = 120;
  const dates = series(1, [[0, 0], [N - 1, 0]], 0, 0, N, 2016, 12).dates;
  const qDates = dates.filter((_, i) => i % 3 === 0);
  const aDates = dates.filter((_, i) => i % 12 === 0);
  const mk = (seed, anchors, step, name, label, color, unit, ds = dates) => {
    const g = series(seed, anchors, step, 0.7, ds.length, 2016, 12);
    g.dates = ds;
    return { name, label, color, data: g.data, unit };
  };
  const tradeOil = {
    dates,
    series: {
      oil_exports: mk(20260301, [[0, 3200], [60, 5200], [119, 5600]], 60, "oil_exports_usd_millions", "Oil exports", "#A8A293", "USD_millions"),
      non_oil_exports: mk(20260302, [[0, 19800], [60, 29800], [119, 38100]], 250, "non_oil_exports_usd_millions", "Non-oil exports", "#5B564B", "USD_millions"),
      oil_imports: mk(20260303, [[0, 7600], [60, 11800], [119, 13800]], 120, "oil_imports_usd_millions", "Oil imports", "#C6C0B0", "USD_millions"),
      non_oil_imports: mk(20260304, [[0, 23400], [60, 39200], [119, 47600]], 300, "non_oil_imports_usd_millions", "Non-oil imports", "#8A857A", "USD_millions"),
    },
  };
  const bop = {
    dates: qDates,
    series: {
      current_account: mk(20260305, [[0, -8200], [20, -14500], [39, -2400]], 900, "current_account_net_usd_millions", "Current account", "#BE3E26", "USD_millions", qDates),
      capital_account: mk(20260306, [[0, 14200], [20, 19800], [39, 17600]], 800, "capital_account_net_usd_millions", "Capital account", "#5B564B", "USD_millions", qDates),
      errors_omissions: mk(20260307, [[0, 400], [20, -600], [39, 300]], 250, "errors_omissions_net_usd_millions", "Errors & omissions", "#A8A293", "USD_millions", qDates),
      overall: mk(20260308, [[0, 6400], [20, 4700], [39, 15500]], 700, "overall_bop_net_usd_millions", "Overall balance", "#8A857A", "USD_millions", qDates),
    },
  };
  const bopRatios = {
    dates: aDates,
    series: {
      exports_gdp: mk(20260309, [[0, 12.1], [5, 11.4], [9, 11.3]], 0.2, "bop_exports_gdp_pct", "Exports / GDP", "#5B564B", "pct_of_gdp", aDates),
      imports_gdp: mk(20260310, [[0, 18.4], [5, 17.2], [9, 17.0]], 0.25, "bop_imports_gdp_pct", "Imports / GDP", "#A8A293", "pct_of_gdp", aDates),
      invisibles_net_gdp: mk(20260311, [[0, 4.6], [5, 5.2], [9, 5.4]], 0.08, "bop_invisibles_net_gdp_pct", "Invisibles net / GDP", "#8A857A", "pct_of_gdp", aDates),
      cad_gdp: mk(20260312, [[0, -1.7], [5, -0.9], [9, -0.6]], 0.1, "bop_cad_gdp_pct", "CAD / GDP", "#BE3E26", "pct_of_gdp", aDates),
      foreign_investment_gdp: mk(20260313, [[0, 1.6], [5, 1.4], [9, 1.2]], 0.06, "bop_foreign_investment_gdp_pct", "Foreign investment / GDP", "#C6C0B0", "pct_of_gdp", aDates),
      import_cover: mk(20260314, [[0, 8.2], [5, 10.1], [9, 11.0]], 0.15, "import_cover_months", "Import cover of reserves", "#5B564B", "months", aDates),
    },
  };
  const debt = {
    dates: aDates,
    series: {
      gross_external_debt: mk(20260315, [[0, 455000], [5, 558000], [9, 736000]], 4000, "external_debt_gross_external_debt_usd_millions", "Gross external debt", "#BE3E26", "USD_millions", aDates),
      commercial_borrowing: mk(20260316, [[0, 158000], [5, 192000], [9, 261000]], 2000, "external_debt_commercial_borrowing_usd_millions", "Commercial borrowing", "#5B564B", "USD_millions", aDates),
      nri_deposits: mk(20260317, [[0, 121000], [5, 139000], [9, 164000]], 1500, "external_debt_nri_deposits_usd_millions", "NRI deposits", "#8A857A", "USD_millions", aDates),
      trade_credit: mk(20260318, [[0, 86000], [5, 104000], [9, 128000]], 1200, "external_debt_trade_credit_usd_millions", "Trade credit", "#A8A293", "USD_millions", aDates),
      debt_service_ratio: mk(20260319, [[0, 6.4], [5, 5.8], [9, 5.9]], 0.1, "external_debt_debt_service_ratio_pct", "Debt service ratio", "#5B564B", "pct", aDates),
      debt_to_gdp: mk(20260320, [[0, 19.2], [5, 19.6], [9, 19.1]], 0.12, "external_debt_debt_to_gdp_pct", "Debt / GDP", "#8A857A", "pct", aDates),
      short_term_pct: mk(20260321, [[0, 18.9], [5, 19.4], [9, 18.7]], 0.1, "external_debt_short_term_pct_pct", "Short-term share", "#A8A293", "pct", aDates),
      concessional_pct: mk(20260322, [[0, 9.4], [5, 8.8], [9, 8.2]], 0.08, "external_debt_concessional_pct_pct", "Concessional share", "#C6C0B0", "pct", aDates),
    },
  };
  const nri = {
    dates,
    series: {
      outstanding_total: mk(20260323, [[0, 121000], [60, 139000], [119, 168000]], 1200, "nri_deposits_outstanding_total_usd_millions", "Outstanding · Total", "#BE3E26", "USD_millions"),
      outstanding_fcnrb: mk(20260324, [[0, 24000], [60, 26000], [119, 31000]], 400, "nri_deposits_outstanding_fcnrb_usd_millions", "Outstanding · FCNR(B)", "#5B564B", "USD_millions"),
      outstanding_nre_ra: mk(20260325, [[0, 76000], [60, 89000], [119, 108000]], 900, "nri_deposits_outstanding_nre_ra_usd_millions", "Outstanding · NR(E)RA", "#8A857A", "USD_millions"),
      outstanding_nro: mk(20260326, [[0, 21000], [60, 24000], [119, 29000]], 300, "nri_deposits_outstanding_nro_usd_millions", "Outstanding · NRO", "#A8A293", "USD_millions"),
      flows_total: mk(20260327, [[0, 320], [60, 480], [119, 610]], 180, "nri_deposits_flows_total_usd_millions", "Net flows · Total", "#C6C0B0", "USD_millions"),
      flows_fcnrb: mk(20260328, [[0, 60], [60, 90], [119, 120]], 60, "nri_deposits_flows_fcnrb_usd_millions", "Net flows · FCNR(B)", "#C6C0B0", "USD_millions"),
      flows_nre_ra: mk(20260329, [[0, 210], [60, 310], [119, 390]], 120, "nri_deposits_flows_nre_ra_usd_millions", "Net flows · NR(E)RA", "#C6C0B0", "USD_millions"),
      flows_nro: mk(20260330, [[0, 50], [60, 80], [119, 100]], 45, "nri_deposits_flows_nro_usd_millions", "Net flows · NRO", "#C6C0B0", "USD_millions"),
    },
  };
  return { tradeOil, bop, bopRatios, debt, nri };
}

export function mockIip() {
  const dates = series(1, [[0, 0], [119, 0]], 0, 0, 120, 2016, 12).dates;
  const mk = (seed, anchors, step, name, label, color, i) => {
    const g = series(seed, anchors, step, 0.7, 120, 2016, 12);
    return { name, label, color, data: g.data };
  };
  const TOP = [["general", "General", 3.2], ["sector_mining", "Mining & Quarrying", 2.4], ["sector_manufacturing", "Manufacturing", 3.4], ["sector_electricity", "Electricity", 4.1], ["use_primary_goods", "Primary Goods", 2.8], ["use_capital_goods", "Capital Goods", 3.9], ["use_intermediate_goods", "Intermediate Goods", 3.1], ["use_infrastructure_construction_goods", "Infrastructure/ Construction Goods", 4.4], ["use_consumer_durables", "Consumer Durables", 2.2], ["use_consumer_non_durables", "Consumer Non-durables", 3.6]];
  const top = { dates, series: {}, crosscheck: { headline_growth_published: [] } };
  TOP.forEach(([k, label, base], i) => {
    top.series[k] = mk(20261300 + i, [[0, base], [48, base + 1.8], [84, base - 0.6], [119, base + 0.9]], 0.15, `iip_${k}_yoy_pct_base2011`, label, k === "general" ? "#BE3E26" : GREYS[i % GREYS.length], i);
  });
  top.crosscheck.headline_growth_published = top.series.general.data;
  const IND = [["sub_manufacturing_manufacture_of_food_products", "Manufacture of Food Products"], ["sub_manufacturing_manufacture_of_textiles", "Manufacture of Textiles"], ["sub_manufacturing_manufacture_of_basic_metals", "Manufacture of Basic Metals"], ["sub_manufacturing_manufacture_of_motor_vehicles_trailers_and_semi_trailers", "Manufacture of Motor Vehicles"], ["sub_manufacturing_manufacture_of_electrical_equipment", "Manufacture of Electrical Equipment"], ["sub_manufacturing_manufacture_of_chemicals_and_chemical_products", "Manufacture of Chemicals"]];
  const ind = { dates, series: {} };
  IND.forEach(([k, label], i) => {
    ind.series[k] = mk(20261400 + i, [[0, 2.6 + (i % 3)], [48, 4.4 + (i % 4)], [84, 1.8 + (i % 3)], [119, 3.2 + (i % 2)]], 0.2, `iip_${k}_yoy_pct_base2011`, label, GREYS[i % GREYS.length], i);
  });
  const short22 = (b) => ({ dates: dates.slice(-27), series: Object.fromEntries(Object.entries(b.series).map(([k, s]) => [k, { ...s, name: s.name.replace("base2011", "base2022"), data: s.data.slice(-27) }])) });
  return { top, ind, top22: { ...short22(top), crosscheck: { headline_growth_published: top.series.general.data.slice(-27) } }, ind22: short22(ind) };
}

export function mockIsp() {
  const s = series(20260210, [[0,100.2],[2,103.1],[4,106.4],[6,109.8],[8,112.4],[10,115.1],[12,118.6],[14,121.2]], 0.4, 0.8, 15, 2025, 12);
  s.dates = s.dates.map((d) => new Date(new Date(d + "T00:00:00Z").setUTCMonth(new Date(d + "T00:00:00Z").getUTCMonth() + 3)).toISOString().slice(0, 10));
  return {
    dates: s.dates,
    series: {
      wholesale_trade: { name: "isp_wholesale_trade_index", label: "Wholesale Trade", color: "#BE3E26", data: s.data, unit: "index" },
    },
  };
}

const GREYS = ["#5B564B", "#8A857A", "#A8A293", "#C6C0B0"];

export function mockCpiSectors() {
  const mk = (seed, drift) => {
    const s = series(seed, [[0, 6.0 + drift], [24, 3.4 + drift], [48, 5.5 + drift], [60, 7.8 + drift], [72, 6.2 + drift], [84, 5.1 + drift], [96, 4.0 + drift], [108, 6.6 + drift], [119, 2.9 + drift]], 0.1, 0.8, 120, 2016, 12);
    return s;
  };
  const one = (seed, drift, sfx) => {
    const h = mk(seed, drift), f = mk(seed + 1, drift + 0.8), fu = mk(seed + 2, drift - 0.4), c = mk(seed + 3, drift + 0.2);
    return {
      dates: h.dates,
      series: {
        headline: { name: `headline_cpi${sfx}_yoy_pct`, label: "Headline", color: "#BE3E26", data: h.data },
        food: { name: `food_beverages${sfx}_yoy_pct`, label: "Food", color: "#5B564B", data: f.data },
        fuel: { name: `fuel_light${sfx}_yoy_pct`, label: "Fuel", color: "#A8A293", data: fu.data },
        core: { name: `core${sfx}_yoy_pct`, label: "Core", color: "#C6C0B0", data: c.data },
      },
    };
  };
  return { rural: one(20260301, 0.5, "_rural"), urban: one(20260311, -0.3, "_urban") };
}

export function mockCpiSubgroups() {
  const keys = ["cereals_and_products", "meat_and_fish", "egg", "milk_and_products", "oils_and_fats", "fruits", "vegetables", "pulses_and_products", "sugar_and_confectionery", "spices", "non_alcoholic_beverages", "prepared_meals_snacks_sweets_etc", "pan_tobacco_and_intoxicants", "clothing", "footwear", "household_goods_and_services", "health", "transport_and_communication", "recreation_and_amusement", "education", "personal_care_and_effects"];
  const s = {};
  keys.forEach((k, i) => {
    const g = series(20260400 + i, [[0, 4 + (i % 5)], [40, 6 + (i % 4)], [80, 3 + (i % 6)], [119, 3.5 + (i % 3)]], 0.1 + (i % 3) * 0.1, 0.8, 120, 2016, 12);
    s[k] = { name: `cpi_${k}_yoy_pct`, label: k.replace(/_/g, " "), color: GREYS[i % GREYS.length], data: g.data };
  });
  return { dates: series(1, [[0, 0], [119, 0]], 0, 0, 120, 2016, 12).dates, series: s };
}

export function mockCpiStates() {
  const states = ["andhra_pradesh", "assam", "bihar", "chhattisgarh", "delhi", "gujarat", "haryana", "himachal_pradesh", "jammu_and_kashmir", "jharkhand", "karnataka", "kerala", "madhya_pradesh", "maharashtra", "odisha", "punjab", "rajasthan", "tamil_nadu", "telangana", "uttar_pradesh", "uttarakhand", "west_bengal"];
  const s = {};
  states.forEach((k, i) => {
    const g = series(20260500 + i, [[0, 5.5 + (i % 4) * 0.5], [48, 6.2], [84, 4.8], [119, 2.8 + (i % 3) * 0.4]], 0.12, 0.8, 120, 2016, 12);
    s[k] = { name: `cpi_${k}_yoy_pct`, label: k.replace(/_/g, " "), color: GREYS[i % GREYS.length], data: g.data, published: true };
  });
  return { dates: series(1, [[0, 0], [119, 0]], 0, 0, 120, 2016, 12).dates, series: s };
}

export function mockCpiStatesSectors() {
  const states = ["andhra_pradesh", "assam", "bihar", "delhi", "gujarat", "haryana", "karnataka", "kerala", "maharashtra", "punjab", "rajasthan", "tamil_nadu", "uttar_pradesh", "west_bengal"];
  const s = {};
  states.forEach((k, i) => {
    ["rural", "urban"].forEach((sec, si) => {
      const g = series(20261200 + i * 2 + si, [[0, 5.8 + (i % 4) * 0.5 + si * 0.4], [48, 6.4], [84, 4.6], [119, 2.6 + (i % 3) * 0.4]], 0.12, 0.8, 120, 2016, 12);
      s[`${k}_${sec}`] = { name: `cpi_${k}_${sec}_yoy_pct`, label: `${k.replace(/_/g, " ")} · ${sec}`, color: GREYS[i % GREYS.length], data: g.data, published: true };
    });
  });
  return { dates: series(1, [[0, 0], [119, 0]], 0, 0, 120, 2016, 12).dates, series: s };
}

export function mockGdpAccounts() {
  const N = 10; // annual, fiscal years 2016-17 .. 2025-26
  const mk = (seed, anchors) => series(seed, anchors, 0.2, 0.7, N, 2016, 1);
  const s = (k, label, i, g) => [k, { name: `${k}_real_yoy_pct`, label, color: GREYS[i % GREYS.length], data: g.data }];
  const entries = [
    s("ndp", "NDP", 0, mk(20260601, [[0, 7.6], [4, -6.2], [5, 9.4], [8, 7.4], [9, 6.4]])),
    s("gni", "GNI", 1, mk(20260602, [[0, 7.8], [4, -5.9], [5, 9.6], [8, 7.6], [9, 6.6]])),
    s("gndi", "GNDI", 2, mk(20260603, [[0, 7.9], [4, -5.7], [5, 9.5], [8, 7.5], [9, 6.5]])),
    s("gross_saving", "Gross saving", 3, mk(20260604, [[0, 6.4], [4, -4.2], [5, 8.4], [8, 8.4], [9, 7.2]])),
    s("taxes", "Taxes on products", 0, mk(20260605, [[0, 8.4], [4, -9.4], [5, 12.6], [8, 9.2], [9, 7.8]])),
    s("subsidies", "Subsidies", 1, mk(20260606, [[0, 4.2], [4, 18.4], [5, 8.2], [8, -8.4], [9, 4.4]])),
    s("cfc", "Capital consumption", 2, mk(20260607, [[0, 7.2], [4, 2.4], [5, 6.8], [8, 7.4], [9, 7.1]])),
    s("gcf_industry", "Capital formation", 3, mk(20260608, [[0, 7.4], [4, -10.2], [5, 14.4], [8, 9.4], [9, 7.6]])),
  ];
  const dates = entries[0][1].data.map((_, i) => `${2016 + i}-04-01`);
  return { dates, series: Object.fromEntries(entries) };
}

export function mockWpiGroups() {
  const keys = ["food_articles", "non_food_articles", "minerals", "crude_petroleum_natural_gas", "coal", "mineral_oils", "electricity", "manufactured_food_products", "beverages", "textiles", "chemicals_chemical_products", "basic_metals", "machinery_equipment", "motor_vehicles"];
  const s = {};
  keys.forEach((k, i) => {
    const g = series(20260700 + i, [[0, 2 + (i % 4)], [36, 4 + (i % 5)], [78, 8 + (i % 7)], [96, 2 + (i % 3)], [119, 1.5 + (i % 4) * 0.5]], 0.15 + (i % 3) * 0.15, 0.78, 120, 2016, 12);
    s[k] = { name: `wpi_${k}_yoy_pct`, label: k.replace(/_/g, " "), color: GREYS[i % GREYS.length], data: g.data };
  });
  return { dates: series(1, [[0, 0], [119, 0]], 0, 0, 120, 2016, 12).dates, series: s };
}

export function mockWpiSubgroups() {
  const keys = ["food_grains_cereals_pulses", "fruits_vegetables", "milk", "eggs_meat_fish", "oil_seeds", "mineral_oils", "manufacture_of_dairy_products", "manufacture_of_grain_mill_products", "manufacture_of_sugar_molasses_honey", "manufacture_of_textiles", "manufacture_of_basic_metals", "manufacture_of_machinery_and_equipment"];
  const s = {};
  keys.forEach((k, i) => {
    const g = series(20260900 + i, [[0, 3 + (i % 5)], [36, 5 + (i % 6)], [78, 9 + (i % 8)], [96, 2 + (i % 4)], [119, 2 + (i % 3)]], 0.2 + (i % 3) * 0.15, 0.78, 120, 2016, 12);
    s[k] = { name: `wpi_${k}_yoy_pct`, label: k.replace(/_/g, " "), color: GREYS[i % GREYS.length], data: g.data };
  });
  return { dates: series(1, [[0, 0], [119, 0]], 0, 0, 120, 2016, 12).dates, series: s };
}

export function mockPlfsCutsAnnual(mDates) {
  const cuts = {};
  ["male", "female"].forEach((g, gi) => {
    ["rural", "urban"].forEach((s, si) => {
      ["ur", "lfpr", "wpr"].forEach((k, ki) => {
        const base = k === "ur" ? 5.5 : k === "lfpr" ? 56 : 54;
        const adj = (gi ? (k === "ur" ? 0.4 : -18) : 0) + (si ? (k === "ur" ? 1.2 : -2) : 0);
        const d = series(20260800 + gi * 10 + si * 3 + ki, [[0, base + adj + 0.6], [7, base + adj], [14, base + adj - 0.4]], 0.05, 0.7, 15, 2025, 12);
        cuts[`${k}_${g}_${s}`] = { name: `plfs_${k}_${g}_${s}_pct`, label: `${k.toUpperCase()} · ${g} · ${s}`, color: GREYS[(gi * 2 + si) % GREYS.length], data: d.data };
      });
    });
  });
  const cutsBundle = { dates: mDates, series: cuts };
  const aSeries = {};
  ["cws", "psss"].forEach((ws, wi) => {
    ["ur", "lfpr", "wpr"].forEach((k, ki) => {
      const base = k === "ur" ? (wi ? 4.2 : 5.8) : k === "lfpr" ? (wi ? 53.4 : 56.2) : (wi ? 51.2 : 53.0);
      const d = series(20260900 + wi * 3 + ki, [[0, base + 0.8], [4, base + 0.2], [7, base]], 0.04, 0.7, 8, 2017, 1);
      aSeries[`${k}_${ws}`] = { name: `plfs_${k}_annual_${ws}_pct`, label: `${k.toUpperCase()} · ${ws === "cws" ? "CWS" : "PS+SS"}`, color: wi === 0 ? "#BE3E26" : "#5B564B", data: d.data };
    });
  });
  const annualBundle = { dates: aSeries.ur_cws.data.map((_, i) => `${2017 + i}-07-01`), series: aSeries };
  return { cutsBundle, annualBundle };
}

export function mockPlfsStates() {
  const states = ["andhra_pradesh", "assam", "bihar", "gujarat", "haryana", "karnataka", "kerala", "madhya_pradesh", "maharashtra", "odisha", "punjab", "rajasthan", "tamil_nadu", "uttar_pradesh", "west_bengal"];
  const s = {};
  states.forEach((k, i) => {
    ["cws", "psss"].forEach((ws, wi) => {
      const base = (wi ? 4.6 : 7.2) + (i % 5) * 0.8;
      const d = series(20261100 + i * 2 + wi, [[0, base], [4, base - 1.2], [7, base - 1.8]], 0.05, 0.7, 8, 2017, 1);
      s[`${k}_${ws}`] = { name: `plfs_ur_${k}_annual_${ws}_pct`, label: `${k.replace(/_/g, " ")} · ${ws === "cws" ? "CWS" : "PS+SS"}`, color: GREYS[i % GREYS.length], data: d.data };
    });
  });
  return { dates: [...Array(8)].map((_, i) => `${2017 + i}-07-01`), series: s };
}

export function mockCpialrlStates() {
  const states = ["andhra_pradesh", "assam", "bihar", "chhattisgarh", "gujarat", "haryana", "himachal_pradesh", "jharkhand", "karnataka", "kerala", "madhya_pradesh", "maharashtra", "odisha", "punjab", "rajasthan", "tamil_nadu", "telangana", "uttar_pradesh", "west_bengal"];
  const s86 = {};
  states.forEach((k, i) => {
    const g = series(20261000 + i, [[0, 6.4 + (i % 5) * 0.4], [50, 5.2], [100, 4.0]], 0.1, 0.8, 101, 2017, 12);
    s86[k] = { name: `cpi_al_${k}_yoy_pct_base1986`, label: k.replace(/_/g, " "), color: GREYS[i % GREYS.length], data: g.data };
  });
  const b86 = { dates: series(1, [[0, 0], [100, 0]], 0, 0, 101, 2017, 12).dates, series: s86 };
  const s19 = {};
  let d19 = null;
  states.forEach((k, i) => {
    const g = series(20261100 + i, [[0, 130 + (i % 6)], [11, 136 + (i % 5)]], 0.1, 0.9, 12, 2025, 12);
    g.dates = g.dates.map((d) => new Date(new Date(d + "T00:00:00Z").setUTCMonth(new Date(d + "T00:00:00Z").getUTCMonth() + 5)).toISOString().slice(0, 10));
    d19 ??= g.dates;
    s19[k] = { name: `cpi_al_${k}_index_base2019`, label: k.replace(/_/g, " "), color: GREYS[i % GREYS.length], data: g.data };
  });
  const b19 = { dates: d19, series: s19 };
  return { b86, b19 };
}
