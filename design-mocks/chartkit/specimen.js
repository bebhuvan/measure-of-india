// Specimen sheet for the chart kit: every form, drawn from real Atlas bundles.
import * as K from './kit.js';

const F = await (await fetch('fixtures.json')).json();
const $ = s => document.querySelector(s);
const last = arr => arr.filter(p => p[1] != null).at(-1);
const pct = (v, dp = 1) => K.num(v, { dp, suffix: '%' });
const FULL = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const monthName = d => FULL[+String(d).slice(5, 7) - 1];
const proper = s => s.replace(/\b([a-z])/g, (m, c) => c.toUpperCase()).replace(/\b(And|Of|The)\b/g, w => w.toLowerCase()).replace(/^./, c => c.toUpperCase());

// ---- derived data -------------------------------------------------------------------
const cpiLinked = F.cpi.linked.filter(([d]) => d >= '2014-01');
const cpiOld = F.cpi.old.filter(([d]) => d >= '2014-01');
const cpiNow = last(cpiLinked);
const gdp = F.gdp.real;
const gdpNow = last(gdp);
const states = F.cpiStates.rows.filter(r => r.iso);
const stLatest = Object.fromEntries(states.map(r => [r.iso, r.data.at(-1)]));
const stNames = Object.fromEntries(states.map(r => [r.iso, r.name]));
const stSorted = states.slice().sort((a, b) => b.data.at(-1) - a.data.at(-1));
const stMonth = F.cpiStates.dates.at(-1);
const reserves = F.reserves.map(([d, v]) => [d, v == null ? null : v / 1000]);
const resNow = last(reserves), resMin = reserves.filter(p => p[1] != null && p[0] < '1995').sort((a, b) => a[1] - b[1])[0];
const repo = F.repo.filter(([d]) => d >= '2000');
const repoNow = last(repo);
const ur = F.urStates.rows.map(r => ({ name: proper(r.name.replace(/&/g, 'and')), a: r.rural, b: r.urban, highlight: /^all india$/i.test(r.name) }));
const groups = F.cpiGroups.rows.map(r => ({ name: r.name, data: F.cpiGroups.dates.map((d, i) => [d, r.data[i]]) }));
const headline8 = F.cpiGroups.dates.map((d, i) => [d, F.cpiStates.india[i]]);
groups.forEach(g => { g.highlight = g.data.at(-1)[1] > F.cpiStates.india.at(-1); });
groups.sort((a, b) => b.data.at(-1)[1] - a.data.at(-1)[1]);
const items = F.cpiItems.rows.map(r => {
  const h = r.data.slice(-132); const lv = h.filter(v => v != null).at(-1);
  return { name: r.name, latest: lv, history: h, extra: r.level };
}).filter(r => r.latest != null && r.history.filter(v => v != null).length > 60);
items.sort((a, b) => b.latest - a.latest);
const itemRows = [...items.slice(0, 10), { gap: `${items.length - 16} items in between`, history: [] }, ...items.slice(-6)];
const pw = F.power, pIdx = pw.years.length - 1;
const pRow = n => pw.rows.find(r => r.name === n).data;
const fossilNow = ['Coal', 'Gas', 'Other fossil'].reduce((a, n) => a + pRow(n)[pIdx], 0);

// ---- the cards ------------------------------------------------------------------------
const CARDS = [
  { form: 'Line, with a base-year seam and a target band',
    title: `Consumer prices were ${pct(cpiNow[1])} higher in ${monthName(cpiNow[0])} than a year before, inside the RBI's band for the ${countInBand()} month running`,
    sub: 'Consumer Price Index, all India, year-on-year change, per cent, on base 2024=100. The lighter stretch is the statistics office’s back-cast of the new index; the live print begins in January 2025.',
    src: 'Source: MoSPI, National Statistical Office. The base-2024 series before January 2025 is the NSO’s back-cast.',
    draw: w => K.line({ width: w, freq: 'month', unit: { suffix: '%' }, endDp: 1,
      series: [{ name: 'Base 2024', data: cpiLinked, role: 'lead', recon: '2025-01' }], endSub: monthName(cpiNow[0]),
      notes: [lowNote()],
      band: { from: 2, to: 6, label: 'RBI tolerance band, 2 to 6%' }, refs: [{ y: 4, label: 'Target, 4%' }],
      seam: { t: '2025-01', before: 'Back-cast', after: 'Live print' }, nameOnEnd: false }) },

  { form: 'Columns, time, with the latest picked out',
    title: `The economy grew ${pct(gdpNow[1])} in the ${K.tlabel(gdpNow[0], 'quarter')} quarter, ${sinceHigher()}`,
    sub: 'Real GDP, growth on the same quarter a year earlier, per cent, base 2011-12.',
    src: 'Source: MoSPI, National Accounts. Quarterly estimates are revised for about three years.',
    draw: w => K.columns({ width: w, data: gdp, freq: 'quarter', unit: { suffix: '%' },
      events: [{ t: '2020-04', label: 'The lockdown quarter\nApr–Jun 2020: −23.1%', side: 'right' }, { t: '2021-04', label: 'The rebound\n+22.6% on a low base', side: 'right' }] }) },

  { form: 'India tile map',
    title: `Prices rose fastest in ${stSorted[0].name} (${pct(stSorted[0].data.at(-1))}) and slowest in ${stSorted.at(-1).name} (${pct(stSorted.at(-1).data.at(-1))})`,
    sub: `Consumer Price Index by state and union territory, ${K.tlabel(stMonth)}, year-on-year change, per cent. Each state is one equal tile.`,
    src: 'Source: MoSPI. State baskets differ; compare a state with itself over time before comparing states.',
    draw: w => K.tileMap({ width: Math.min(w, 600), values: stLatest, names: stNames, unit: { suffix: '%' }, legendLabel: 'Year-on-year, per cent' }) },

  { form: 'Ranked bars, with a reference line',
    title: `${stSorted.filter(r => r.data.at(-1) > F.cpiStates.india.at(-1)).length} of 36 states and UTs ran above the all-India rate`,
    sub: `The same figures ranked. Consumer Price Index, ${K.tlabel(stMonth)}, year-on-year, per cent.`,
    src: 'Source: MoSPI, National Statistical Office.',
    draw: w => K.bars({ width: w, unit: { suffix: '%' }, rows: states.map(r => ({ name: r.name, value: r.data.at(-1) })), ref: { value: F.cpiStates.india.at(-1), label: `India ${pct(F.cpiStates.india.at(-1))}` } }) },

  { form: 'Dumbbell',
    title: `In ${ur.filter(r => r.b > r.a).length} of ${ur.length} states and UTs, joblessness is higher in towns than in villages`,
    sub: `Unemployment rate, rural against urban, age 15 and above, usual status, calendar year 2025, per cent. Sorted by the urban rate.`,
    src: 'Source: MoSPI, Periodic Labour Force Survey (calendar-year estimates, 2025).',
    draw: w => K.dumbbell({ width: w, rows: ur, keys: { a: 'Rural', b: 'Urban' }, unit: { suffix: '%' }, flagWhen: r => r.a > r.b, flagLabel: 'higher in villages' }) },

  { form: 'Arrows: where each group moved',
    title: `${groups.filter(g => g.highlight).length} of the 43 groups in the basket are rising faster than the headline, led by personal effects, which carry gold`,
    sub: `Consumer Price Index, the 43 groups of the 2024 basket, year-on-year, per cent: each arrow runs from ${monthName(F.cpiGroups.dates[0])} to ${monthName(F.cpiGroups.dates.at(-1))} 2026.`,
    src: 'Source: MoSPI, National Statistical Office.',
    draw: w => K.arrows({ width: w, unit: { suffix: '%' }, from: monthName(F.cpiGroups.dates[0]), to: monthName(F.cpiGroups.dates.at(-1)),
      rows: groups.map(g => ({ name: g.name, from: g.data[0][1], to: g.data.at(-1)[1] })), ref: { value: F.cpiStates.india.at(-1), label: `Headline ${pct(F.cpiStates.india.at(-1))}` } }) },

  { form: 'Small multiples, one shared scale',
    title: `Every large state took the 2020-21 fall; ${gsdpRebound() === 12 ? 'all twelve' : gsdpRebound() + ' of the twelve'} grew faster than 6% in their latest year`,
    sub: 'Real gross state domestic product, growth on the year before, per cent, base 2011-12. The twelve largest state economies, on one scale.',
    src: 'Source: MoSPI, state accounts. The latest year is an advance or quick estimate in most states.',
    draw: w => K.multiples({ width: w, fy: true, unit: { suffix: '%' }, panels: F.gsdp.rows.map(r => ({ name: r.name, data: F.gsdp.dates.map((d, i) => [d, r.data[i]]), highlight: true })) }) },

  { form: 'Range table (in place of the sparkline table)',
    title: `Where each item's price inflation sits in its own ten-year range`,
    sub: 'Consumer Price Index, base 2012, the 299 items, year-on-year, per cent, 2015 to 2025. The bar is each item’s middle half of months, the tick its median, the dot December 2025; red above its usual range, indigo below.',
    src: 'Source: MoSPI. Index level at December 2025, 2012=100.',
    draw: w => K.rangeTable({ width: w, rows: itemRows, unit: { suffix: '%' }, window: '2015 to 2025', columns: { extra: 'Index' }, clamp: [-40, 80] }) },

  { form: 'Composition over time',
    title: `Fossil fuels still make ${pct(fossilNow, 0)} of India's electricity, but solar and wind have grown to ${pct(pRow('Solar')[pIdx] + pRow('Wind')[pIdx], 0)}`,
    sub: `Electricity generation by source, share of the total, per cent, ${pw.years[0]} to ${pw.years.at(-1)}. Low-carbon sources stacked; the line is their combined share.`,
    src: 'Source: Ember, yearly electricity data. Net imports are left out, so shares can miss 100 by a fraction.',
    draw: w => K.share({ width: w, years: pw.years, rest: `Coal, gas and other fossil fuels make up the rest: ${pct(fossilNow)} in ${pw.years.at(-1)}`, boundary: { name: 'All low-carbon' }, restShort: `Fossil fuels: the other ${pct(fossilNow)}`, layers: [
      { name: 'Solar', data: pRow('Solar'), color: K.C.turmeric }, { name: 'Wind', data: pRow('Wind'), color: K.C.lead },
      { name: 'Hydro', data: pRow('Hydro'), color: '#9FCBC4' }, { name: 'Nuclear', data: pRow('Nuclear'), color: '#CDB3D0' },
      { name: 'Bioenergy', data: pRow('Bioenergy'), color: '#D3E6E2' }] }) },

  { form: 'Line, long history, with a filled level',
    title: `Foreign-exchange reserves have grown from $${K.num(resMin[1], { dp: 1 })} billion in ${K.tlabel(resMin[0])} to $${K.num(resNow[1], { dp: 0 })} billion`,
    sub: 'Foreign-exchange reserves, end of month, US$ billion.',
    src: 'Source: Reserve Bank of India, Database on Indian Economy.',
    draw: w => K.line({ width: w, freq: 'month', unit: { prefix: '$' }, endDp: 0, endFormat: v => '$' + K.num(v, { dp: 0 }) + ' bn',
      series: [{ name: 'Reserves', data: reserves, role: 'lead', area: true }],
      events: [{ t: '1991-07', label: '1991 balance-of-payments crisis', short: '1991 crisis' }, { t: '2008-09', label: 'Global financial crisis', short: '2008 crash' }] }) },

  { form: 'Step line',
    title: `The repo rate stands at ${pct(repoNow[1], 2)}`,
    sub: 'RBI policy repo rate, per cent, every change since 2000.',
    src: 'Source: Reserve Bank of India.',
    draw: w => K.line({ width: w, freq: 'day', unit: { suffix: '%' }, endDp: 2, zero: false, stepTo: '2026-10-15',
      series: [{ name: 'Repo rate', data: repo, role: 'lead', step: true }], tDomain: [2000, K.tnum('2026-10-15')] }) },

  { form: 'Waterfall',
    title: `Services and money sent home covered a ${usd(-F.bop.rows[0][1])} goods deficit; income paid abroad left a current-account gap of ${usd(-F.bop.total[1])} in ${fy(F.bop.year)}`,
    sub: `Balance of payments, current account, net, US$ billion, ${fy(F.bop.year)}. Each bar starts where the last one ended.`,
    src: 'Source: Reserve Bank of India, balance of payments (BPM6). Inflows indigo, outflows red.',
    draw: w => K.waterfall({ width: w, unit: { prefix: '$' }, rows: F.bop.rows.map(([n, v]) => [n, v / 1000]), total: [F.bop.total[0], F.bop.total[1] / 1000], fmt: v => (v < 0 ? '−' : '+') + '$' + K.num(Math.abs(v), { dp: 1 }) + ' bn', fmtShort: v => (v < 0 ? '−' : '+') + K.num(Math.abs(v), { dp: 0 }) }) },

  { form: 'Population pyramid, with a comparison year',
    title: `India has grown older since 1990: the young base has narrowed and the working ages have filled out`,
    sub: 'Population by age and sex, share of the whole population, per cent. Bars are 2023; the outline is 1990.',
    src: 'Source: United Nations, World Population Prospects. Five-year age groups.',
    draw: w => K.pyramid({ width: Math.min(w, 760), groups: F.pyramid.groups, male: F.pyramid.male[1], female: F.pyramid.female[1], year: 2023, ghost: { male: F.pyramid.male[0], female: F.pyramid.female[0], year: 1990 } }) },

  { form: 'Scatter',
    title: scatterTitle(),
    sub: 'Net state domestic product per person, current prices, latest year, against the unemployment rate, age 15 and above, 2025. Dotted lines are the medians.',
    src: 'Source: MoSPI, state accounts; Periodic Labour Force Survey, calendar year 2025.',
    draw: w => K.scatter({ width: w, xLabel: 'Income per person, ₹ lakh', yLabel: 'Unemployment rate', yUnit: { suffix: '%' }, xFmt: v => K.num(v / 1e5, { dp: v % 1e5 ? 1 : 0 }),
      points: F.scatter.map(p => ({ ...p, short: p.name.replace('Andaman & Nicobar Islands', 'Andaman & Nicobar') })), label: scatterLabels() }) },

  { form: 'Heatmap, years by months',
    title: `Consumer inflation, every month since 2014: the hot stretches of 2020 and 2022, and the cool autumn of 2025`,
    sub: 'Consumer Price Index, all India, year-on-year, per cent, base 2024 (back-cast before 2025). Red above the 4% target, blue below.',
    src: 'Source: MoSPI, National Statistical Office.',
    draw: w => K.heatmap({ width: w, cols: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'], mid: 4, unit: { suffix: '%' }, legend: ['Below the 4% target', 'above'],
      rows: [...new Set(cpiLinked.map(p => p[0].slice(0, 4)))].map(y => ({ name: y, cells: Array.from({ length: 12 }, (_, m) => (cpiLinked.find(p => p[0] === `${y}-${String(m + 1).padStart(2, '0')}`) ?? [])[1] ?? null) })) }) },

  { form: 'Slope',
    title: `Income per person has risen everywhere since 2011-12, fastest in ${F.slope.slice().sort((a, b) => b.b / b.a - a.b / a.a)[0].name}`,
    sub: 'Net state domestic product per person, constant 2011-12 prices, rupees, 2011-12 and the latest year. The six fastest risers in indigo; the fourteen largest states.',
    src: 'Source: MoSPI, state accounts. Latest year varies by state.',
    draw: w => K.slope({ width: w, left: '2011-12', right: 'Latest', fmt: v => '₹' + K.num(v / 1000, { dp: 0 }) + 'k',
      rows: F.slope.filter(r => !/Andaman|Chandigarh|Puducherry|Delhi|Goa|Sikkim/.test(r.name)).slice(0, 14).map(r => ({ ...r, highlight: fastest6().includes(r.name) })) }) },

  { form: 'Distribution (a strip of every item)',
    title: `Most of the 299 items in the old basket ran between 0% and 8% in December 2025; a few ran far outside`,
    sub: 'Consumer Price Index, base 2012, every item, year-on-year, per cent, December 2025. Red dots ran above the headline.',
    src: 'Source: MoSPI. One dot per item; dots stack where items crowd.',
    draw: w => K.strip({ width: w, unit: { suffix: '%' }, clamp: [-40, 60], values: items.map(r => ({ name: r.name, v: r.latest })), ref: { value: cpiOld.filter(p => p[1] != null).at(-1)[1], label: 'Headline' }, label: ['Silver', 'Gold', 'Tomato', 'Garlic (gm)', 'Onion', 'Coconut Oil'] }) },

  { form: '100% stacked bars',
    title: `Coal makes most of the power in almost every big state; Karnataka and Tamil Nadu lean furthest on wind and sun`,
    sub: `Electricity generation by source, share of each state's total, per cent, ${F.mix.year}. The fifteen largest generators, sorted by coal.`,
    src: 'Source: Ember, India state electricity data.',
    draw: w => K.stackBars({ width: w, sortBy: 0, parts: [
        { name: 'Coal', color: '#5D6168' }, { name: 'Gas', color: '#8E9299' }, { name: 'Other fossil', color: '#B9BCC1' }, { name: 'Nuclear', color: K.C.plum },
        { name: 'Hydro', color: K.C.teal }, { name: 'Bioenergy', color: '#7DBDB2' }, { name: 'Other renewables', color: '#B8DAD4' }, { name: 'Wind', color: K.C.lead }, { name: 'Solar', color: K.C.turmeric }],
      rows: F.mix.rows.map(r => ({ name: r.name === 'India Total' ? 'India' : r.name, parts: r.parts, highlight: r.name === 'India Total' })) }) },
];
function usd(v) { return '$' + K.num(v / 1000, { dp: 0 }) + ' billion'; }
function fy(d) { const y = +d.slice(0, 4); return `${y}-${String((y + 1) % 100).padStart(2, '0')}`; }
function scatterTitle() {
  const P = F.scatter, n = P.length, mx = P.reduce((a, p) => a + p.x, 0) / n, my = P.reduce((a, p) => a + p.y, 0) / n;
  const r = P.reduce((a, p) => a + (p.x - mx) * (p.y - my), 0) / Math.sqrt(P.reduce((a, p) => a + (p.x - mx) ** 2, 0) * P.reduce((a, p) => a + (p.y - my) ** 2, 0));
  const lead = Math.abs(r) < 0.2 ? 'A state\'s income per person says almost nothing about its unemployment rate' : r > 0 ? 'Richer states tend to report more unemployment, not less' : 'Richer states tend to report less unemployment';
  return `${lead} (correlation ${K.num(r, { dp: 2 })})`;
}
function scatterNote() { const big = F.scatter.filter(p => p.y >= 8).map(p => p.name); return `${big.slice(0, 2).join(' and ')} sit high on both`; }
function scatterLabels() { const s = F.scatter.slice(); const pick = new Set([...s.sort((a, b) => b.x - a.x).slice(0, 3), ...s.sort((a, b) => b.y - a.y).slice(0, 3), ...s.sort((a, b) => a.x - b.x).slice(0, 2)].map(p => p.name)); return [...pick]; }
function fastest6() { return F.slope.filter(r => !/Andaman|Chandigarh|Puducherry|Delhi|Goa|Sikkim/.test(r.name)).slice(0, 14).sort((a, b) => b.b / b.a - a.b / a.a).slice(0, 6).map(r => r.name); }
function gsdpRebound() { return F.gsdp.rows.filter(r => (r.data.filter(v => v != null).at(-1) ?? 0) > 6).length; }
function lowNote() {
  const live = cpiLinked.filter(([d, v]) => d >= '2025-01' && v != null), lo = live.reduce((a, b) => b[1] < a[1] ? b : a);
  return { d: lo[0], v: lo[1], text: `${pct(lo[1], Math.abs(lo[1]) < 0.1 ? 2 : 1)} in ${monthName(lo[0])} ${lo[0].slice(0, 4)}\nthe lowest of the live print`, side: 'left', below: false };
}
function sinceHigher() {
  const v = gdp.filter(p => p[1] != null); const lastV = v.at(-1)[1];
  let k = v.length - 2; while (k >= 0 && v[k][1] <= lastV) k--;
  return k < 0 ? 'the fastest on record' : `its fastest in ${v.length - 1 - k} quarters`;
}
function countInBand() {
  let n = 0; for (let i = cpiLinked.length - 1; i >= 0; i--) { const v = cpiLinked[i][1]; if (v == null || v < 2 || v > 6) break; n++; }
  const w = ['zero', 'first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth', 'tenth', 'eleventh', 'twelfth'];
  return w[n] ?? `${n}th`;
}

// ---- figures row ---------------------------------------------------------------------
function figures() {
  const f = (k, v, unit, d, spark, ref) => `<div class="fig"><p class="k">${k}</p><p class="v">${v}<small>${unit}</small></p><p class="d">${d}</p>${spark ? K.spark(spark, { width: 150, height: 34, ref }) : ''}</div>`;
  const prevCpi = cpiLinked.filter(p => p[1] != null).at(-2)[1];
  return `<figure class="card"><p class="form-name">The number as the chart</p><div class="figs">` +
    f('Consumer prices', K.num(cpiNow[1], { dp: 1 }), '%', `${monthName(cpiNow[0])} 2026 · <b>${K.num(cpiNow[1] - prevCpi, { dp: 1, sign: true })} pt</b> on ${monthName(cpiLinked.filter(p => p[1] != null).at(-2)[0])}`, cpiLinked.slice(-36), 4) +
    f('Real GDP growth', K.num(gdpNow[1], { dp: 1 }), '%', `${K.tlabel(gdpNow[0], 'quarter')}`, gdp.slice(-16)) +
    f('Forex reserves', '$' + K.num(resNow[1], { dp: 0 }), ' bn', K.tlabel(resNow[0]), reserves.slice(-36)) +
    f('Repo rate', K.num(repoNow[1], { dp: 2 }), '%', `since ${new Date(repoNow[0]).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`, null) +
    `</div></figure>`;
}

// ---- render ----------------------------------------------------------------------------
function render() {
  const fam = $('#font').value;
  document.documentElement.style.setProperty('--sans', `${fam}, system-ui, sans-serif`);
  K.setMeasure(K.browserMeasure(`${fam}, system-ui, sans-serif`));
  document.body.classList.toggle('phone', $('#width').value === 'phone');
  const main = $('#cards');
  const w = Math.floor(main.getBoundingClientRect().width);
  main.innerHTML = figures() + CARDS.map((c, i) => `<figure class="card" id="c${i}"><p class="form-name">${c.form}</p><h3>${c.title}</h3><p class="sub">${c.sub}</p><div class="plot">${c.draw(w)}</div><figcaption><span>${c.src}</span><button class="act" type="button">Download ↓</button></figcaption></figure>`).join('');
  K.enhance(main);
}
await document.fonts.ready;
$('#font').onchange = $('#width').onchange = render;
let lastW = innerWidth; addEventListener('resize', () => { if (innerWidth === lastW) return; lastW = innerWidth; clearTimeout(window.__r); window.__r = setTimeout(render, 150); });
const qs = new URLSearchParams(location.search);
if (qs.get('font')) $('#font').value = qs.get('font');
if (qs.get('w')) $('#width').value = qs.get('w');
await Promise.all(["'Libre Franklin'", "'Golos Text'", "'Source Sans 3'"].flatMap(f => [400, 500, 600].map(w => document.fonts.load(`${w} 12px ${f}`))));
render();
document.body.dataset.ready = '1';
