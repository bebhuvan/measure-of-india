// Guide page mock: consumer prices. Every figure in the prose is computed from the data.
import * as K from '../chartkit/kit.js';
const F = await (await fetch('../chartkit/fixtures.json')).json();
const $ = s => document.querySelector(s);
const MONTH = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const mname = d => MONTH[+d.slice(5, 7) - 1];
const pct = (v, dp = 1) => K.num(v, { dp, suffix: '%' });
const WORD = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen'];
const ORD = ['', 'first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth', 'tenth'];

// ---- the numbers -----------------------------------------------------------------------------
const cpi = F.cpi.linked.filter(([d]) => d >= '2014-01'), live = cpi.filter(p => p[1] != null);
const now = live.at(-1), prev = live.at(-2), yearAgo = live.find(p => p[0] === `${+now[0].slice(0, 4) - 1}${now[0].slice(4)}`);
const low = live.filter(p => p[0] >= '2025-01').reduce((a, b) => b[1] < a[1] ? b : a);
let above = 0; for (let i = live.length - 1; i >= 0 && live[i][1] > 4; i--) above++;
const groups = F.cpiGroups.rows.map(r => ({ name: r.name, from: r.data[0], to: r.data.at(-1) })).sort((a, b) => b.to - a.to);
const food = groups.find(g => g.name === 'Food');
const hotter = groups.filter(g => g.to > now[1]).length;
const st = F.cpiStates.rows.filter(r => r.iso).map(r => ({ name: r.name, iso: r.iso, v: r.data.at(-1) })).sort((a, b) => b.v - a.v);
const stAbove = st.filter(r => r.v > F.cpiStates.india.at(-1)).length;
const items = F.cpiItems.rows.map(r => { const h = r.data.slice(-132); return { name: r.name, latest: h.filter(v => v != null).at(-1), history: h, extra: r.level }; })
  .filter(r => r.latest != null && r.history.filter(v => v != null).length > 60).sort((a, b) => b.latest - a.latest);
const years = [...new Set(cpi.map(p => p[0].slice(0, 4)))];

$('#dateline').innerHTML = `<span><b>Thursday 15 October 2026</b></span><span>Consumer prices for ${mname(now[0])}, released 12 September 2026 · Next print 13 October</span>`;

const TOC = ['The latest reading', 'Inside the basket', 'Across the states', 'Month by month since 2014', 'Item by item, on the old basket'];
function part(i, title, sub, marginHtml, bodyHtml) {
  return `<section class="part" id="p${i}">
    <div class="sheet part-head"><div class="m"><div class="num">${String(i).padStart(2, '0')}</div></div><div class="f"><h2>${title}</h2>${sub ? `<p>${sub}</p>` : ''}</div></div>
    <div class="sheet"><div class="m">${marginHtml}</div><div class="f">${bodyHtml}</div></div></section>`;
}
const card = (id, title, sub, src) => `<figure class="card"><h3>${title}</h3><p class="sub">${sub}</p><div class="plot" id="${id}"></div><figcaption><span>${src}</span><span class="act"><button type="button">Download</button><button type="button">Share</button></span></figcaption></figure>`;

function render() {
  const field = Math.floor(document.querySelector('.wrap').getBoundingClientRect().width - (innerWidth > 960 ? 268 + 64 : 0) - (innerWidth > 640 ? 32 : 0));
  K.setMeasure(K.browserMeasure(getComputedStyle(document.body).getPropertyValue('--sans')));
  $('#page').innerHTML = `
  <div class="crumb"><a href="#">Guides</a> / <a href="#">Prices</a> / Consumer prices</div>
  <section class="sheet title-block">
    <div class="m"><div class="readouts">
      <div><div class="fig-l">${K.num(now[1], { dp: 1 })}<small>%</small></div><div class="lab">All items, ${mname(now[0])} 2026</div><div class="delta">${K.num(now[1] - prev[1], { dp: 1, sign: true })} pt on ${mname(prev[0])}</div></div>
      <div><div class="fig-l">${K.num(food.to, { dp: 1 })}<small>%</small></div><div class="lab">Food, ${mname(now[0])} 2026</div><div class="delta">${K.num(food.to - food.from, { dp: 1, sign: true })} pt since January</div></div>
    </div></div>
    <div class="f">
      <div class="kicker">Prices</div>
      <h1>Consumer prices</h1>
      <p class="lede">Every month the statistics office prices about three hundred things an ordinary household buys, from rice and onions to school fees and phone plans, and reports how much dearer the whole basket has become in a year.</p>
      <dl class="facts">
        <div><dt>Published by</dt><dd>MoSPI, National Statistics Office</dd></div>
        <div><dt>Released</dt><dd>Monthly, around the 12th</dd></div>
        <div><dt>Base</dt><dd>2024 = 100, from January 2025</dd></div>
        <div><dt>Retired base</dt><dd>2012 = 100, to December 2025</dd></div>
        <div><dt>Covers</dt><dd>India, 36 states and UTs, rural and urban</dd></div>
        <div><dt>Latest</dt><dd>${mname(now[0])} 2026, released 12 September</dd></div>
      </dl>
    </div>
  </section>
  <section class="sheet" style="padding-top:56px"><div class="m"><div class="kicker" style="padding-top:4px">On this page</div></div>
    <div class="f"><ol class="toc">${TOC.map((t, i) => `<li><span>${String(i + 1).padStart(2, '0')}</span><a href="#p${i + 1}">${t}</a></li>`).join('')}</ol></div></section>
  ${part(1, 'The latest reading', null,
    `<div class="fig-l">${K.num(now[1], { dp: 1 })}<small>%</small></div><div class="delta" style="margin-top:6px">${mname(now[0])} 2026, year on year</div>
     <div class="margin-note"><b>Year on year</b>Each figure compares a month's prices with the same month a year earlier, so seasonal swings in vegetables and fruit wash out.</div>`,
    `<div class="prose"><p>Consumer prices were ${pct(now[1])} higher in ${mname(now[0])} than a year earlier, up from ${pct(prev[1])} in ${mname(prev[0])} and ${pct(yearAgo[1])} in ${mname(yearAgo[0])} last year. It is the ${ORD[above] ?? above + 'th'} month running above the Reserve Bank's target of 4%, though still inside the band of 2% to 6% that the law allows.</p>
     <p>A year earlier the worry ran the other way: inflation fell to ${pct(low[1], 2)} in ${mname(low[0])} ${low[0].slice(0, 4)}, the lowest in the series. Since then food prices have turned, and ${WORD[hotter] ?? hotter} of the basket's forty-three groups are now rising faster than the whole.</p></div>
     ${card('c1', `Prices are rising faster than the RBI's 4% target again, for the ${ORD[above] ?? above + 'th'} month running`, 'Consumer Price Index, all India, year on year, per cent, on base 2024=100. Lighter before January 2025, when the statistics office’s back-cast gives way to the live print.', 'Source: MoSPI, National Statistics Office.')}`)}
  ${part(2, 'Inside the basket', 'Forty-three groups of goods and services make up the basket. Where each moved this year tells you whether rising prices are broad or narrow.',
    `<div class="margin-note"><b>Gold sits in “personal effects”</b>Jewellery is priced at the world gold price, so this group follows the bullion market more than Indian demand. Read the rest of the basket without it.</div>`,
    card('c2', `${WORD[hotter] ?? hotter} of the 43 groups are rising faster than the headline; gold-heavy personal effects lead at ${pct(groups[0].to)}`.replace(/^./, c => c.toUpperCase()), `Consumer Price Index, 2024 basket, year on year, per cent. Each arrow runs from ${mname(F.cpiGroups.dates[0])} to ${mname(F.cpiGroups.dates.at(-1))} 2026.`, 'Source: MoSPI, National Statistics Office.'))}
  ${part(3, 'Across the states', `Each state has its own basket and its own index. ${stAbove} of 36 ran above the all-India rate in ${mname(F.cpiStates.dates.at(-1))}.`,
    `<div class="margin-note" style="display:block"><b>Compare a state with itself</b>State baskets weigh things differently, so a state’s trend over time says more than its rank against another state.</div>`,
    card('c3', `Prices rose fastest in ${st[0].name} (${pct(st[0].v)}) and slowest in ${st.at(-1).name} (${pct(st.at(-1).v)})`, `Consumer Price Index by state and union territory, ${mname(F.cpiStates.dates.at(-1))} 2026, year on year, per cent. One equal tile per state.`, 'Source: MoSPI, National Statistics Office.') +
    card('c4', `${stAbove} states and union territories ran above the all-India rate`, 'The same figures ranked, with the all-India rate marked.', 'Source: MoSPI, National Statistics Office.'))}
  ${part(4, 'Month by month since 2014', null,
    `<div class="margin-note"><b>Reading the grid</b>Each cell is one month’s inflation. Red runs above the 4% target, blue below; the deeper the colour, the further from target.</div>`,
    card('c5', `The hot stretches of 2020 and 2022, and the cool autumn of 2025`, 'Consumer Price Index, all India, year on year, per cent, base 2024 (back-cast before 2025).', 'Source: MoSPI, National Statistics Office.'))}
  ${part(5, 'Item by item, on the old basket', 'The 2012 basket priced 299 items until December 2025. Its item indices show who paid more for what over a decade.',
    `<div class="margin-note"><b>A different ruler</b>These figures are on the retired 2012 base and stop in December 2025. They are never joined to the 2024 series.</div>`,
    card('c6', 'Most items ran between 0% and 8% in December 2025; silver, gold and coconut oil ran far above', 'Consumer Price Index, base 2012, every item, year on year, per cent, December 2025. Red dots ran above the headline.', 'Source: MoSPI. One dot per item.') +
    card('c7', 'Where each item’s inflation sits in its own ten-year range', 'The bar is the middle half of each item’s months from 2015 to 2025, the tick its median, the dot December 2025.', 'Source: MoSPI. Index level at December 2025, 2012=100.'))}
  `;
  const W = field, M = mname(now[0]);
  $('#c1').innerHTML = K.line({ width: W, freq: 'month', unit: { suffix: '%' }, endDp: 1, endSub: M, series: [{ name: 'Consumer prices', data: cpi, role: 'lead', recon: '2025-01' }],
    band: { from: 2, to: 6, label: 'RBI tolerance band, 2 to 6%' }, refs: [{ y: 4, label: 'Target, 4%' }], seam: { t: '2025-01', before: 'Back-cast', after: 'Live print' }, nameOnEnd: false,
    notes: [{ d: low[0], v: low[1], text: `${pct(low[1], 2)} in ${mname(low[0])} ${low[0].slice(0, 4)}\nthe lowest in the series`, side: 'left' }] });
  $('#c2').innerHTML = K.arrows({ width: W, unit: { suffix: '%' }, from: mname(F.cpiGroups.dates[0]), to: mname(F.cpiGroups.dates.at(-1)), rows: groups, ref: { value: now[1], label: `All items ${pct(now[1])}` } });
  $('#c3').innerHTML = K.tileMap({ width: Math.min(W, 720), values: Object.fromEntries(st.map(r => [r.iso, r.v])), names: Object.fromEntries(st.map(r => [r.iso, r.name])), unit: { suffix: '%' }, legendLabel: 'Year on year, per cent' });
  $('#c4').innerHTML = K.bars({ width: W, unit: { suffix: '%' }, rows: st.map(r => ({ name: r.name, value: r.v })), ref: { value: F.cpiStates.india.at(-1), label: `India ${pct(F.cpiStates.india.at(-1))}` } });
  $('#c5').innerHTML = K.heatmap({ width: W, cols: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'], mid: 4, unit: { suffix: '%' }, legend: ['Below the 4% target', 'above'],
    rows: years.map(y => ({ name: y, cells: Array.from({ length: 12 }, (_, m) => (cpi.find(p => p[0] === `${y}-${String(m + 1).padStart(2, '0')}`) ?? [])[1] ?? null) })) });
  $('#c6').innerHTML = K.strip({ width: W, unit: { suffix: '%' }, clamp: [-40, 60], values: items.map(r => ({ name: r.name, v: r.latest })), ref: { value: F.cpi.old.filter(p => p[1] != null).at(-1)[1], label: 'All items' }, label: ['Silver', 'Gold', 'Tomato', 'Garlic (gm)', 'Onion', 'Coconut Oil'] });
  $('#c7').innerHTML = K.rangeTable({ width: W, rows: [...items.slice(0, 8), { gap: `${items.length - 14} items in between`, history: [] }, ...items.slice(-6)], unit: { suffix: '%' }, window: '2015 to 2025', columns: { extra: 'Index' }, clamp: [-40, 80] });
  K.enhance($('#page'));
}
await document.fonts.ready;
await Promise.all([400, 500, 600].map(w => document.fonts.load(`${w} 12px "Libre Franklin"`)));
render();
let lw = innerWidth; addEventListener('resize', () => { if (innerWidth === lw) return; lw = innerWidth; clearTimeout(window.__r); window.__r = setTimeout(render, 150); });
document.body.dataset.ready = '1';
