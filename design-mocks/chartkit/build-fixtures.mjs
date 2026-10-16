// Pulls real Atlas series into one fixture for the chart-kit specimen sheet.
// Run from the repo root: node design-mocks/chartkit/build-fixtures.mjs
import fs from 'node:fs';
import {STATES} from '../../src/dossiers/states-key.js';
const L = f => { const b = JSON.parse(fs.readFileSync(`data/series/${f}.json`)); b.S = Array.isArray(b.series) ? b.series : Object.values(b.series); return b; };
const ser = (b, pred) => b.S.find(pred);
const pairs = (dates, data) => dates.map((d, i) => [d.slice(0, 7), data[i] ?? null]);
const out = {};

// 1. CPI headline across the base-2024 / base-2012 seam
const linked = L('cpi-2024-linked'), old = L('cpi');
out.cpi = { linked: pairs(linked.dates, linked.S[0].data), old: pairs(old.dates, ser(old, s => s.label === 'Headline').data), src: 'MoSPI, NSO' };

// 2. GDP real growth, quarterly (base 2011-12)
const gdp = L('gdp');
out.gdp = { real: pairs(gdp.dates, ser(gdp, s => s.name === 'gdp_real_yoy_pct').data) };

// 3. CPI by state, latest month (and the eight-month path)
const st = L('cpi-2024-states');
const norm = s => s.toLowerCase().replace(/&/g, 'and').replace(/[^a-z]/g, '');
out.cpiStates = { dates: st.dates.map(d => d.slice(0, 7)), rows: st.S.map(s => {
  const alias = { nctofdelhi: 'delhi', thedadraandnagarhaveliandddamananddiu: 'dadraandnagarhaveliandddamananddiu' }; const lab = norm(s.label).replace(/^nctof/, '').replace(/^the/, ''); const k = STATES.find(x => norm(x.name) === lab || norm(x.short ?? '') === lab);
  return { name: k?.short ?? k?.name ?? s.label, iso: k?.iso?.slice(3) ?? null, data: s.data };
}) };
out.cpiStates.india = linked.S[0].data.slice(-8);

// 4. CPI groups (43), Jan–Aug 2026
const g = L('cpi-2024-groups');
out.cpiGroups = { dates: g.dates.map(d => d.slice(0, 7)), rows: g.S.map(s => ({ name: s.label, division: s.division, data: s.data })) };

// 5. CPI items 2012 basket: level + ten-year y/y path
const it = L('cpi-items-2012');
out.cpiItems = { dates: it.dates.map(d => d.slice(0, 7)), rows: it.S.map(s => ({ name: s.label, level: s.latest_level, data: s.data })) };

// 6. FX reserves, monthly, US$ million
const fx = L('external-reserves-monthly');
out.reserves = pairs(fx.dates, ser(fx, s => /^Total reserves/.test(s.label)).data);

// 7. Power generation mix, share %
const en = L('energy-ember-national-electricity-generation-pct');
const pick = ['Coal', 'Gas', 'Nuclear', 'Hydro', 'Wind', 'Solar', 'Bioenergy', 'Other fossil'];
out.power = { years: en.dates.map(d => d.slice(0, 4)), rows: pick.map(p => ({ name: p, data: ser(en, s => s.label.split(' / ')[1] === p).data })) };

// 8. Unemployment, rural vs urban, by state, CY2025, age 15+, usual status
const ur = L('plfs-cy25-states-ur');
const sex = ['person', 'persons', 'all', 'total'].find(w => ur.S.some(s => s.label.split(' · ')[2] === w)) ?? 'men';
const get = (state, area) => ur.S.find(s => { const p = s.label.split(' · '); return p[1] === state && p[2] === sex && p[3] === area && p[4] === 'age 15 and above' && p[5] === 'usual status' && p.length === 6; })?.data[0] ?? null;
const states = [...new Set(ur.S.map(s => s.label.split(' · ')[1]))];
out.urStates = { sex, rows: states.map(s => ({ name: s, rural: get(s, 'rural'), urban: get(s, 'urban'), all: get(s, 'rural and urban') })).filter(r => r.rural != null && r.urban != null) };

// 9. Repo rate (step series)
const r = L('rates-policy');
out.repo = pairs(r.dates.map(d => d.slice(0, 10)), ser(r, s => /repo/i.test(s.label)).data).map(([d, v], i) => [r.dates[i].slice(0, 10), v]);

// 10. Real GSDP growth, the twelve largest state economies (base 2011-12)
const lv = L('states-gsdp-constant'), gr = L('states-growth-real');
const size = lv.S.map(s => ({ st: s.label.split(':')[0], v: s.data.filter(v => v != null).at(-1) })).sort((a, b) => b.v - a.v).slice(0, 12);
out.gsdp = { dates: gr.dates.map(d => d.slice(0, 7)), rows: size.map(({ st }) => ({ name: st, data: gr.S.find(s => s.label === `${st}: GSDP growth, real`)?.data ?? [] })) };

// 11. Balance of payments, latest year, US$ million (waterfall)
const bop = L('external-bop-annual'), bget = lab => bop.S.find(s => s.label === lab)?.data.at(-1) ?? null;
out.bop = { year: bop.dates.at(-1).slice(0, 7), unit: bop.meta.unit ?? null, rows: [
  ['Goods trade', bget('1.1 MERCHANDISE, net')], ['Services', bget('1.2.1 Services, net')],
  ['Transfers', bget('1.2.2 Transfers, net')], ['Income', bget('1.2.3 Income, net')]], total: ['Current account', bget('1 CURRENT ACCOUNT, net')] };

// 12. Population by age and sex, UN WPP (thousands): 2023 and 1990
const wpp = L('population-wpp-age'), wi = y => wpp.dates.findIndex(d => d.startsWith(String(y)));
const groups = [...new Set(wpp.S.map(s => (s.label.match(/aged (\d+-\d+|100\+?)[, ]/) ?? [])[1]).filter(Boolean))].filter(g => /^100/.test(g) || +g.split('-')[1] - +g.split('-')[0] === 4);
const wv = (g, sex, y) => wpp.S.find(s => s.label === `Population aged ${g}, ${sex}, thousands`)?.data[wi(y)] ?? null;
out.pyramid = { years: [1990, 2023], groups, male: [1990, 2023].map(y => groups.map(g => wv(g, 'males', y))), female: [1990, 2023].map(y => groups.map(g => wv(g, 'females', y))) };

// 13. States: per-person income against unemployment (scatter)
const pc = L('states-pcnsdp-current'), urb = L('plfs-cy25-states-ur');
const nn = s => s.toLowerCase().replace(/&/g, 'and').replace(/[^a-z]/g, '');
out.scatter = pc.S.map(s => { const st = s.label.split(':')[0];
  const u = urb.S.find(x => { const p = x.label.split(' · '); return nn(p[1]) === nn(st) && p[2] === 'person' && p[3] === 'rural and urban' && p[4] === 'age 15 and above' && p[5] === 'usual status' && p.length === 6; });
  const v = s.data.filter(x => x != null).at(-1); return { name: st, x: v, y: u?.data[0] ?? null, year: pc.dates[s.data.lastIndexOf(v)]?.slice(0, 4) };
}).filter(r => r.x != null && r.y != null);

// 14. Per-person income, constant prices, first and latest year (slope)
const pk = L('states-pcnsdp-constant');
out.slope = pk.S.map(s => { const d = s.data; const li = d.map((v, i) => v != null ? i : -1).filter(i => i >= 0).at(-1); return { name: s.label.split(':')[0], a: d[0], b: d[li], by: pk.dates[li].slice(0, 4) }; })
  .filter(r => r.a != null && r.b != null).sort((p, q) => q.b - p.b);
out.slopeYears = [pk.dates[0].slice(0, 4)];

// 15. Generation mix by state, latest year (100% bars)
const eg = L('energy-ember-states-yearly-electricity-generation-gwh');
const fuels = ['Coal', 'Gas', 'Other Fossil', 'Nuclear', 'Hydro', 'Bioenergy', 'Other Renewables', 'Wind', 'Solar'];
const est = [...new Set(eg.S.map(s => s.label.split(' / ')[0]))];
out.mix = { year: eg.dates.at(-1).slice(0, 4), fuels, rows: est.map(st => { const row = fuels.map(f => eg.S.find(s => s.label.startsWith(st + ' / ') && s.label.endsWith('/ Fuel / ' + f))?.data.at(-1) ?? 0);
  return { name: st, total: row.reduce((a, b) => a + (b ?? 0), 0), parts: row }; }).sort((a, b) => b.total - a.total).slice(0, 15) };

fs.writeFileSync('design-mocks/chartkit/fixtures.json', JSON.stringify(out));
console.log(Object.fromEntries(Object.entries(out).map(([k, v]) => [k, JSON.stringify(v).length])), 'sex:', sex, 'ur rows', out.urStates.rows.length, 'unmatched states', out.cpiStates.rows.filter(r => !r.iso).map(r => r.name));
