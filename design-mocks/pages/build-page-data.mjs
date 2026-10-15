// Real data for the page mocks (landing + guide). Run from the repo root.
import fs from 'node:fs';
import { DOSSIERS } from '../../src/dossiers/registry.js';
import { HEADLINE } from '../../src/dossiers/headline.js';
const load = b => JSON.parse(fs.readFileSync(`data/series/${b}.json`));
const keyed = j => Array.isArray(j.series) ? Object.fromEntries(j.series.map(s => [s.name, s])) : j.series;
const out = { ledger: [], guides: [] };

// the ledger: the economy's pulse, one row per monthly/quarterly measure
const ROWS = [
  ['cpi', 'cpi-2024-linked', 'headline', 'Consumer prices', 'year on year', '%', 'month', 1],
  ['wpi', 'wpi-2022', 'headline', 'Wholesale prices', 'year on year', '%', 'month', 2],
  ['gdp', 'gdp-2022', 'gdp', 'GDP', 'real, year on year', '%', 'quarter', 1],
  ['iip', 'iip-2022', 'general', 'Industrial output', 'year on year', '%', 'month', 1],
  ['jobs', 'plfs-monthly', 'ur', 'Unemployment', 'age 15 and over', '%', 'month', 1],
  ['credit', 'credit-growth', 'headline', 'Bank credit', 'year on year', '%', 'month', 1],
  ['trade', 'trade-total', 'balance', 'Trade balance', 'goods, US$ billion', '$bn', 'month', 1],
  ['rates', 'rates-monthly', 'repo', 'Repo rate', 'RBI policy rate', '%', 'month', 2],
];
for (const [slug, b, k, name, what, unit, freq, dp] of ROWS) {
  const j = load(b), s = keyed(j)[k]; if (!s) { console.log('missing', b, k); continue; }
  const dates = j.dates.map(d => d.slice(0, 7)), vals = s.data.map(v => v == null ? null : unit === '$bn' ? v / 1000 : v);
  const li = vals.findLastIndex(v => v != null), step = freq === 'quarter' ? 1 : 1, ya = freq === 'quarter' ? 4 : 12;
  out.ledger.push({ slug, name, what, unit, freq, dp, latest: vals[li], prev: vals[li - step] ?? null, yearAgo: vals[li - ya] ?? null, date: dates[li],
    released: j.meta.releaseDate ?? null, series: dates.slice(Math.max(0, li - (freq === 'quarter' ? 15 : 35)), li + 1).map((d, i, a) => [d, vals[li - a.length + 1 + i]]) });
}
// every guide, with its headline figure as the site prints it
for (const d of DOSSIERS) {
  let value = null, period = null, what = null;
  try { const j = load(d.currentBundle); j.series = keyed(j); const h = HEADLINE[d.slug]; value = h.value(j); what = h.what; period = h.period(j); } catch (e) { value = null; }
  out.guides.push({ slug: d.slug, title: d.title, section: d.section, blurb: d.blurb ?? d.description, value, what, period });
}
fs.writeFileSync('design-mocks/pages/page-data.json', JSON.stringify(out));
console.log(out.ledger.map(r => `${r.name} ${r.latest} ${r.date}`).join('\n')); console.log(out.guides.map(g => `${g.section} | ${g.title} | ${g.value} | ${g.period}`).join('\n'));
