// Landing page mock: the cover (newest print), the ledger, across India, the index of guides.
import * as K from '../chartkit/kit.js';
const F = await (await fetch('../chartkit/fixtures.json')).json();
const D = await (await fetch('page-data.json')).json();
const $ = s => document.querySelector(s);
const MONTH = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const mname = d => MONTH[+d.slice(5, 7) - 1];
const pct = (v, dp = 1) => K.num(v, { dp, suffix: '%' });

// --- derived ----------------------------------------------------------------------------
const cpi = F.cpi.linked.filter(([d]) => d >= '2014-01');
const live = cpi.filter(p => p[1] != null);
const now = live.at(-1), prev = live.at(-2);
let above = 0; for (let i = live.length - 1; i >= 0 && live[i][1] > 4; i--) above++;
let rising = 0; for (let i = live.length - 1; i > 0 && live[i][1] > live[i - 1][1]; i--) rising++;
const ORD = ['', 'first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth', 'tenth'];
const WORD = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];
const finding = `Consumer prices were ${pct(now[1])} higher in ${mname(now[0])} than a year earlier, above the RBI's 4% target for the ${ORD[above] ?? above + 'th'} month running`;
const release = '12 September 2026';

// Display overrides for headline figures that print poorly today (fix belongs in headline.js)
const SHOW = { energy: ['932.8 Mtoe', '2024-25'], pensions: ['7.71 crore', 'June 2026'], 'farm-households': ['₹10,218', '2018-19'], households: ['₹15.9 lakh', '2018'], wpi: ['9.9%', 'August 2026'] };

// --- dateline -------------------------------------------------------------------------------
$('#dateline').innerHTML = `<span><b>Thursday 15 October 2026</b></span><span>Latest release: <b>consumer prices for ${mname(now[0])}</b>, ${release} · Next: September prints from 13 October</span>`;

// --- page ---------------------------------------------------------------------------------------
const main = $('#page');
function render() {
  const field = Math.floor((document.querySelector('.wrap').getBoundingClientRect().width) - (innerWidth > 960 ? 268 + 64 : 0) - (innerWidth > 640 ? 32 : 0));
  K.setMeasure(K.browserMeasure(getComputedStyle(document.body).getPropertyValue('--sans')));

  const ledgerRows = D.ledger.slice().sort((a, b) => b.date.localeCompare(a.date)).map(r => {
    const unit = r.unit === '$bn' ? '' : r.unit, pre = r.unit === '$bn' ? '$' : '';
    const v = r.unit === '$bn' ? (r.latest < 0 ? '−' : '') + '$' + K.num(Math.abs(r.latest), { dp: 1 }) : K.num(r.latest, { dp: r.dp });
    const ch = r.prev == null ? '–' : (r.latest - r.prev === 0 ? 'unchanged' : (r.latest > r.prev ? '▲ ' : '▼ ') + K.num(Math.abs(r.latest - r.prev), { dp: r.dp }) + (r.unit === '%' ? ' pt' : ''));
    const ya = r.yearAgo == null ? '–' : r.unit === '$bn' ? (r.yearAgo < 0 ? '−' : '') + '$' + K.num(Math.abs(r.yearAgo), { dp: 1 }) : K.num(r.yearAgo, { dp: r.dp }) + (r.unit === '%' ? '%' : '');
    const period = r.freq === 'quarter' ? K.tlabel(r.date, 'quarter') : K.tlabel(r.date);
    return `<tr><td><a href="#"><span class="nm">${r.name}</span><span class="wh">${r.what}</span></a></td>
      <td><span class="lv">${v}<small>${r.unit === '%' ? '%' : r.unit === '$bn' ? 'bn' : ''}</small></span></td>
      <td class="ch">${ch}</td><td class="ya">${ya}</td><td class="sp">${K.spark(r.series, { width: innerWidth < 760 ? 96 : 150, height: 34, ref: r.slug === 'cpi' ? 4 : undefined })}</td><td class="pd">${period}</td></tr>`;
  }).join('');

  const st = F.cpiStates.rows.filter(r => r.iso).map(r => ({ name: r.name, iso: r.iso, v: r.data.at(-1) })).sort((a, b) => b.v - a.v);
  const sections = [...new Set(D.guides.map(g => g.section))];
  const index = sections.map(sec => `<section><h4>${sec}</h4>${D.guides.filter(g => g.section === sec).map(g => {
    const [v, p] = SHOW[g.slug] ?? [g.value ?? '', g.period ?? ''];
    return `<a href="#" title="${g.what ?? ''}"><span class="t">${g.title}</span><span class="l"></span><span class="v">${v}</span><span class="w"><i>${(g.what ?? '').replace(/^./, c => c.toUpperCase())}</i> · ${p}</span></a>`; }).join('')}</section>`).join('');

  main.innerHTML = `
  <section class="sheet" style="padding-top:56px">
    <div class="m">
      <div class="kicker"><span class="dot"></span>Latest release</div>
      <div class="fig-xl">${K.num(now[1], { dp: 1 })}<small>%</small></div>
      <div class="delta"><b>Consumer prices</b>, ${mname(now[0])} 2026<br>${K.num(now[1] - prev[1], { dp: 1, sign: true })} pt on ${mname(prev[0])}; rising for ${WORD[rising] ?? rising} months</div>
    </div>
    <div class="f">
      <h1 class="cover-h">${finding}</h1>
      <p class="lede" style="font-size:20px">Prices have climbed back from a series low of ${pct(Math.min(...live.filter(p => p[0] >= '2025-01').map(p => p[1])), 2)} last October. Food is running hotter than the basket as a whole, and gold has pushed personal effects up by almost half.</p>
      <figure class="card" style="margin-top:36px">
        <div class="plot" id="cover"></div>
        <figcaption><span>Consumer Price Index, all India, year on year, per cent, base 2024=100; lighter before January 2025, when the statistics office's back-cast gives way to the live print. Source: MoSPI.</span><span class="act"><button type="button">Read the guide →</button></span></figcaption>
      </figure>
    </div>
  </section>

  <section class="part">
    <div class="sheet part-head"><div class="m"><div class="lab">The ledger</div></div><div class="f"><h2>${(WORD[D.ledger.length] ?? D.ledger.length).replace(/^./, c => c.toUpperCase())} measures that move every month or quarter, as they last printed</h2><p>Newest release first. The trend is the last three years; change is on the print before.</p></div></div>
    <div class="sheet"><div class="span" style="overflow-x:auto">
      <table class="ledger"><thead><tr><th>Measure</th><th>Latest</th><th>Change</th><th class="ya">A year ago</th><th class="sp">Last three years</th><th class="pd">Period</th></tr></thead><tbody>${ledgerRows}</tbody></table>
    </div></div>
  </section>

  <section class="part">
    <div class="sheet part-head"><div class="m"><div class="lab">Across India</div></div><div class="f"><h2>Prices rose fastest in ${st[0].name} and slowest in ${st.at(-1).name}</h2><p>Consumer prices by state and union territory, ${mname(F.cpiStates.dates.at(-1))} 2026, year on year. Each state is one equal tile, so Goa counts as much as Rajasthan.</p></div></div>
    <div class="sheet">
      <div class="m">
        <div class="note" style="display:grid;gap:4px">${st.slice(0, 5).map((r, i) => `<div style="display:flex;justify-content:space-between;border-bottom:1px solid var(--rule);padding:6px 0"><span>${r.name}</span><b class="tab">${pct(r.v)}</b></div>`).join('')}
          <div style="padding:10px 0 2px;color:var(--muted)">…</div>
          ${st.slice(-3).map(r => `<div style="display:flex;justify-content:space-between;border-bottom:1px solid var(--rule);padding:6px 0"><span>${r.name}</span><b class="tab">${pct(r.v)}</b></div>`).join('')}</div>
        <p class="note" style="margin-top:20px"><a href="#" style="font-weight:600;color:var(--ink)">All 36 state profiles →</a></p>
      </div>
      <div class="f" id="tiles"></div>
    </div>
  </section>

  <section class="part">
    <div class="sheet part-head"><div class="m"><div class="lab">The guides</div></div><div class="f"><h2>Thirty-six guides to India's statistics, each with its latest figure</h2><p>Every guide explains what a number measures, how it is made, and how to read it, with every published series and cut to download.</p></div></div>
    <div class="sheet"><div class="span index">${index}</div></div>
  </section>`;

  $('#cover').innerHTML = K.line({ width: field, height: innerWidth < 640 ? 260 : 340, freq: 'month', unit: { suffix: '%' }, endDp: 1, endSub: mname(now[0]),
    series: [{ name: 'Consumer prices', data: cpi, role: 'lead', recon: '2025-01' }], band: { from: 2, to: 6, label: 'RBI tolerance band, 2 to 6%' }, refs: [{ y: 4, label: 'Target, 4%' }],
    seam: { t: '2025-01', before: 'Back-cast', after: 'Live print' }, nameOnEnd: false });
  const tf = $('#tiles').getBoundingClientRect().width;
  $('#tiles').innerHTML = K.tileMap({ width: Math.min(tf, 720), values: Object.fromEntries(st.map(r => [r.iso, r.v])), names: Object.fromEntries(st.map(r => [r.iso, r.name])), unit: { suffix: '%' }, legendLabel: 'Year on year, per cent' });
  K.enhance(main);
}
await document.fonts.ready;
await Promise.all([400, 500, 600].map(w => document.fonts.load(`${w} 12px "Libre Franklin"`)));
render();
let lw = innerWidth; addEventListener('resize', () => { if (innerWidth === lw) return; lw = innerWidth; clearTimeout(window.__r); window.__r = setTimeout(render, 150); });
document.body.dataset.ready = '1';
