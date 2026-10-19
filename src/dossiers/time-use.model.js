// Time use guide: the analytical model. Every figure is a set of rows read from the canonical
// bundles (data/series/time-use-2024-*), each row carrying its bundle, series and original workbook
// cell, plus a `shape` that tells the chart file (time-use.charts.js) how to draw them. Shapes refer
// to rows by index, so nothing is drawn that is not a traced row. Titles and leads are computed here
// from the same rows. Runs at build time and in the facts generator (scripts/time-use-editorial.mjs).
import fs from 'node:fs';
import path from 'node:path';
import { timeUseFormat } from './time-use.format.js';
export { timeUseFormat } from './time-use.format.js';

export const majorNames = ['Employment and related activities', 'Goods for own use', 'Unpaid domestic work', 'Unpaid care', 'Volunteering and other unpaid work', 'Learning', 'Social and religious activities', 'Leisure, media and sport', 'Sleep and personal care'];
// shorter names for chart rows and keys
export const majorShort = ['Employment', 'Goods for own use', 'Domestic work', 'Care', 'Volunteering', 'Learning', 'Social, religious', 'Leisure, media', 'Sleep, personal care'];
const SOURCE = 'National Statistics Office, Time Use in India';
const F = 'Female', M = 'Male';
const fmt = timeUseFormat;
const hm = (m) => { const h = Math.floor(m / 60), r = Math.round(m - h * 60); return h ? (r ? `${h}h ${r}m` : `${h}h`) : `${r} minutes`; };
const pc = (v) => fmt(v, 'pct');

export function timeUseModel(root = process.cwd()) {
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'data/coverage/time-use.manifest.json')));
  const labels = JSON.parse(fs.readFileSync(path.join(root, 'data/coverage/time-use.labels.json')));
  const cache = new Map(), used = new Map(), plates = [], facts = {}, bundleMeta = new Map();

  // ---------------------------------------------------------------- reading the bundles
  const entries = (table) => {
    if (!cache.has(table)) cache.set(table, manifest.bundles.filter((x) => x.table === table).flatMap((x) => {
      const b = JSON.parse(fs.readFileSync(path.join(root, 'data/series/' + x.slug + '.json')));
      bundleMeta.set(x.slug, { period: b.meta.latestPeriod, sourceUrl: b.meta.sourceUrl });
      return Object.entries(b.series).map(([key, s]) => ({ ...s, key, bundle: x.slug, value: s.data[0], sourceUrl: b.meta.sourceUrl, period: b.meta.latestPeriod }));
    }));
    return cache.get(table);
  };
  const one = (table, test, what) => {
    const hits = entries(table).filter((s) => test(s.dims, s));
    if (hits.length !== 1) throw Error(`time-use ${table}: expected one source cut for ${what}, got ${hits.length}`);
    return hits[0];
  };
  const mark = (s) => { if (!used.has(s.bundle)) used.set(s.bundle, new Set()); used.get(s.bundle).add(s.key); return s; };
  const fact = (id, s) => { mark(s); facts[id] = { value: s.value, unit: s.unit, bundle: s.bundle, series: s.key, cell: s.sourceCell.cell }; };

  const nat = (d, g) => d.state === 'All India' && d.sector === 'Combined' && d.gender === g;
  const allAges = (d) => /all \(6 years and above\)/i.test(d.source_column);
  const major = (k) => 'Major Division: ' + k;

  // ---------------------------------------------------------------- building a plate
  // A plate collects rows as it is built; get(s, name) adds a traced row and returns its index.
  function plate(id, group, o) {
    const rows = [];
    const get = (s, name) => {
      if (s.value == null) throw Error(`time-use ${id}: ${name} has no published value`);
      mark(s);
      rows.push({ name, value: s.value, unit: s.unit, bundle: s.bundle, series: s.key, cell: s.sourceCell.cell, sourceRow: s.dims.source_row, sourceColumn: s.dims.source_column ?? null, gender: s.dims.gender ?? null });
      return rows.length - 1;
    };
    const p = { id, group, rows, source: SOURCE, ...o.meta };
    p.shape = o.build(get, rows);
    const v = (i) => rows[i].value;
    p.title = o.title(v, p.shape);
    p.lead = o.lead(v, p.shape, rows);
    if (new Set(rows.map((r) => r.name)).size !== rows.length) throw Error('time-use: ambiguous row names in ' + id);
    const first = bundleMeta.get(rows[0].bundle);
    p.period = first.period; p.sourceUrl = first.sourceUrl;
    p.sourceBundles = [...new Set(rows.map((r) => r.bundle))];
    plates.push(p);
    return p;
  }
  // a paired item: one row for each sex, named "<item> · Females|Males"
  const pair = (get, item, pick) => ({ name: item, a: get(pick(M), item + ' · Males'), b: get(pick(F), item + ' · Females') });

  // ================================================================ headline facts
  for (const g of [F, M]) for (const [id, code] of [['domestic', 3], ['care', 4], ['employment', 1], ['leisure', 8]])
    fact(id + '_' + g.toLowerCase(), one('t8', (d) => nat(d, g) && allAges(d) && d.source_row === major(code), id));
  facts.domestic_gap = { value: facts.domestic_female.value - facts.domestic_male.value, unit: 'minutes', formula: 'female domestic minutes per person − male domestic minutes per person', parts: ['domestic_female', 'domestic_male'] };
  for (const g of [M, F]) {
    fact('domestic_' + g.toLowerCase() + '_participation', one('t6', (d) => nat(d, g) && allAges(d) && d.source_row === major(3), 'domestic participation'));
    fact('domestic_' + g.toLowerCase() + '_participant', one('t7', (d) => nat(d, g) && allAges(d) && d.source_row === major(3), 'domestic participant minutes'));
    fact('salaried_domestic_' + g.toLowerCase(), one('t18', (d) => nat(d, g) && d.source_row === major(3) && d.source_column.endsWith('regular wage/ salaried employee (31)'), 'salaried domestic minutes'));
  }
  for (const [name, cut] of [['lowest', '0-20'], ['highest', '80-100']]) fact('spending_' + name, one('t26', (d) => nat(d, F) && d.source_row === major(3) && d.source_column.endsWith(' / ' + cut), 'spending fifth'));
  const joint = (g, col) => one('t42', (d) => nat(d, g) && d.measure === 'Minutes per person' && new RegExp(col).test(d.source_column) && /^all (?:unapid|unpaid)\/paid ac(?:t)?ivities$/.test(d.source_row), 'paid and unpaid');
  for (const g of [M, F]) {
    fact('total_work_' + g.toLowerCase(), joint(g, 'all \\(6 years and above\\) / .*per person'));
    fact('working_age_work_' + g.toLowerCase(), joint(g, '15-59 years / .*per person'));
  }

  // ================================================================ 1. the day
  const G1 = 'A day of 1,440 minutes';
  const t8 = (g, col, row, sector = 'Combined') => one('t8', (d) => d.state === 'All India' && d.sector === sector && d.gender === g && d.source_column === 'age-group / ' + col && d.source_row === row, `t8 ${g} ${col} ${row}`);
  const ALL = 'all (6 years and above)';
  const dayRow = (get, name, g, col, sector) => ({ name, parts: majorNames.map((n, k) => get(t8(g, col, major(k + 1), sector), `${name} · ${n}`)) });
  plate('day', G1, {
    meta: { sub: 'How the average day is divided, everyone aged six and above, including people who did none of an activity. Each bar is 24 hours.', kind: 'dayBars', explain: 'These are averages across everyone, so a few minutes of care is many people doing none and some doing a lot. When two activities share a half-hour slot, the survey splits the slot between them, so every person’s day still adds up to 24 hours.' },
    build: (get) => ({ rows: [
      dayRow(get, 'Females', F, ALL), dayRow(get, 'Males', M, ALL),
      { ...dayRow(get, 'Rural females', F, ALL, 'Rural'), gap: true, sub: true }, { ...dayRow(get, 'Rural males', M, ALL, 'Rural'), sub: true },
      { ...dayRow(get, 'Urban females', F, ALL, 'Urban'), sub: true }, { ...dayRow(get, 'Urban males', M, ALL, 'Urban'), sub: true },
    ] }),
    title: (v, s) => `Females spend ${hm(v(s.rows[0].parts[2]) + v(s.rows[0].parts[3]))} a day on domestic work and care; males spend ${hm(v(s.rows[1].parts[2]) + v(s.rows[1].parts[3]))}`,
    lead: (v, s) => ({ value: v(s.rows[0].parts[2]) + v(s.rows[0].parts[3]), unit: 'minutes', label: 'Domestic work and care, females, per person', formula: 'sum of two traced rows' }),
  });
  const AGES = [['6-14 years', '6 to 14'], ['15-29 years', '15 to 29'], ['15-59 years', '15 to 59'], ['60 years and above', '60 and above']];
  plate('day-age', G1, {
    meta: { sub: 'The average day by age group, minutes per person. The 15 to 29 group is a part of the 15 to 59 group, not a separate band.', kind: 'dayBars', explain: 'Each age group is a different set of people interviewed in 2024, not the same people followed through life. Girls of six to fourteen already do more domestic work than boys, but most of their day is school, play and sleep, as it is for boys. The gap opens from fifteen.' },
    build: (get) => ({ rows: [F, M].flatMap((g) => AGES.map(([col, n], i) => ({ ...dayRow(get, `${g === F ? 'Females' : 'Males'}, ${n}`, g, col), gap: g === M && i === 0, sub: col === '15-29 years' }))) }),
    title: (v, s) => { const f = s.rows[2], m = s.rows[6]; return `Between 15 and 59, domestic work and care take ${hm(v(f.parts[2]) + v(f.parts[3]))} of the average female day and ${hm(v(m.parts[2]) + v(m.parts[3]))} of the male day`; },
    lead: (v, s) => ({ value: v(s.rows[2].parts[2]) + v(s.rows[2].parts[3]), unit: 'minutes', label: 'Domestic work and care, females 15 to 59', formula: 'sum of two traced rows' }),
  });

  // ================================================================ 2. who does it, and for how long
  const G2 = 'Who does it, and for how long';
  const byMajor = (table, g, code) => one(table, (d) => nat(d, g) && allAges(d) && d.source_row === major(code), `${table} ${g} ${code}`);
  const RECTS = [3, 4, 1, 8];
  plate('rects', G2, {
    meta: { sub: 'Width: the share who did the activity during the day. Height: minutes among those who did it. The area is the average across everyone.', kind: 'rects', explain: 'A gap in the average across everyone can come from who does an activity, from how long they spend on it, or both. Domestic work differs on both: far fewer males do any, and those who do spend far less time. Employment is the reverse.' },
    build: (get) => ({ panels: RECTS.map((k) => {
      const side = (g) => ({ share: get(byMajor('t6', g, k), `${majorShort[k - 1]} · ${g === F ? 'Females' : 'Males'} · share who did it`), minutes: get(byMajor('t7', g, k), `${majorShort[k - 1]} · ${g === F ? 'Females' : 'Males'} · minutes among them`), per: get(byMajor('t8', g, k), `${majorShort[k - 1]} · ${g === F ? 'Females' : 'Males'} · minutes per person`) });
      return { name: majorShort[k - 1], b: side(F), a: side(M) };
    }) }),
    title: (v, s) => { const d = s.panels[0]; return `${pc(v(d.b.share))} of females did domestic work, for ${v(d.b.minutes)} minutes on average; ${pc(v(d.a.share))} of males did, for ${v(d.a.minutes)}`; },
    lead: (v, s) => ({ value: v(s.panels[0].b.share), unit: 'pct', label: 'Females who did domestic work during the day' }),
  });
  plate('participation', G2, {
    meta: { sub: 'Share who did each activity during the reference day, age six and above. A person can do several things in a day, so the shares do not add up. Everyone sleeps, so sleep is left out.', kind: 'dumbbell', explain: 'Socialising, prayer and leisure are close to universal for both sexes. The wide gaps are in domestic work and employment, and they run in opposite directions.' },
    build: (get) => ({ sortBy: 'gap', unit: 'pct', items: [1, 2, 3, 4, 5, 6, 7, 8].map((k) => pair(get, majorShort[k - 1], (g) => byMajor('t6', g, k))) }),
    title: (v, s) => { const e = s.items.find((i) => i.name === 'Employment'); return `${pc(v(e.a))} of males did some employment work during the day, against ${pc(v(e.b))} of females`; },
    lead: (v, s) => { const e = s.items.find((i) => i.name === 'Employment'); return { value: v(e.b), unit: 'pct', label: 'Females who did employment work during the day' }; },
  });
  // normal and other days (t38, all recorded activities)
  const ACC = [['SNA production', 'Economic production'], ['Non-SNA production', 'Household services']];
  plate('day-type', G2, {
    meta: { sub: 'Share who did each kind of work, on a day the informant called normal for the person and on other days. Age six and above.', kind: 'dumbbell', explain: 'Economic production is paid work plus goods made for the household’s own use; household services are domestic work and care. About one interview in nine fell on an other day, and the tables do not say what made a day unusual. This is not a weekday and weekend comparison.' },
    build: (get) => {
      const t38 = (g, row, day) => one('t38', (d, s) => nat(d, g) && s.unit === 'pct' && d.day_type === day && d.source_row === row && allAges(d), `t38 ${g} ${row} ${day}`);
      return { keys: { a: 'Other day', b: 'Normal day' }, unit: 'pct', sortBy: 'none', items: [F, M].flatMap((g) => ACC.map(([row, n]) => { const nm = `${n}, ${g === F ? 'females' : 'males'}`; return { name: nm, a: get(t38(g, row, 'other'), nm + ' · other day'), b: get(t38(g, row, 'normal'), nm + ' · normal day') }; })) };
    },
    title: (v, s) => `On a day that was not normal, the share of males doing economic work fell from ${pc(v(s.items[2].b))} to ${pc(v(s.items[2].a))}; females’ household work fell less, from ${pc(v(s.items[1].b))} to ${pc(v(s.items[1].a))}`,
    lead: (v, s) => ({ value: v(s.items[2].a), unit: 'pct', label: 'Males doing economic production on an other day' }),
  });

  // ================================================================ 3. inside the categories
  const G3 = 'What the broad categories hide';
  const code = (c) => (d) => d.source_row === c || d.source_row === 'Division: ' + c;
  const detail = (table, g, c) => one(table, (d) => nat(d, g) && allAges(d) && code(c)(d), `${table} ${g} ${c}`);
  const TASKS = [['311', 'Cooking'], ['313', 'Cleaning up after meals'], ['312', 'Serving meals'], ['32', 'Cleaning the home'], ['34', 'Washing and caring for clothes'], ['37', 'Shopping for the household'], ['411', 'Feeding, bathing and minding children'], ['415', 'Playing with children'], ['413', 'Teaching and helping children'], ['42', 'Caring for dependent adults']];
  plate('tasks', G3, {
    meta: { sub: 'Minutes per person per day on selected tasks inside domestic work and care, age six and above. Averages across everyone.', kind: 'dumbbell', explain: 'Food is the largest single block of unpaid work. Cooking, serving and clearing up take most of a woman’s domestic time, and almost none of a man’s. In childcare, the physical work of feeding and bathing falls on women; playing with children is shared almost equally.' },
    build: (get) => ({ sortBy: 'b', unit: 'minutes', items: TASKS.map(([c, n]) => pair(get, n, (g) => detail('t8', g, c))) }),
    title: (v, s) => `Females spend ${v(s.items[0].b)} minutes a day cooking, on average; males spend ${v(s.items[0].a)}`,
    lead: (v, s) => ({ value: v(s.items[0].b), unit: 'minutes', label: 'Cooking, females, per person' }),
  });
  const JOBS = [['12', 'In a household business making goods (farms included)'], ['13', 'In a household business providing services'], ['11', 'In a company, government or non-profit'], ['18', 'Travelling to and from work']];
  plate('jobs', G3, {
    meta: { sub: 'Share who did each kind of employment activity during the day, age six and above.', kind: 'dumbbell', explain: 'Most work in India happens in household enterprises, the family farm, shop or workshop, not in companies or government. The commute is recorded as part of employment time.' },
    build: (get) => ({ sortBy: 'none', unit: 'pct', items: JOBS.map(([c, n]) => pair(get, n, (g) => detail('t6', g, c))) }),
    title: (v, s) => `${pc(v(s.items[3].a))} of males travelled to or from work during the day; ${pc(v(s.items[3].b))} of females did`,
    lead: (v, s) => ({ value: v(s.items[3].a), unit: 'pct', label: 'Males who travelled for work' }),
  });
  const FREE = [['71', 'Talking and spending time with others'], ['84', 'TV, radio, phone and other media'], ['85', 'Resting and relaxing'], ['912', 'Naps'], ['74', 'Religious practice'], ['82', 'Hobbies and games'], ['83', 'Sport and exercise']];
  plate('free', G3, {
    meta: { sub: 'Minutes per person per day on selected leisure, social and rest activities, age six and above. Averages across everyone.', kind: 'dumbbell', explain: 'Males have more leisure overall, mostly through media, games and sport. Females spend more time resting, napping and in prayer. Rest recorded in short pieces between tasks is still rest in the survey, but it is not the same as an unbroken evening off.' },
    build: (get) => ({ sortBy: 'b', unit: 'minutes', items: FREE.map(([c, n]) => pair(get, n, (g) => detail('t8', g, c))) }),
    title: (v, s) => { const n = s.items.find((i) => i.name === 'Naps'); return `Females nap for ${v(n.b)} minutes a day on average and males for ${v(n.a)}; males spend more time on media, games and sport`; },
    lead: (v, s) => { const n = s.items.find((i) => i.name === 'Naps'); return { value: v(n.b), unit: 'minutes', label: 'Naps, females, per person' }; },
  });

  // ================================================================ 4. paid and unpaid work together
  const G4 = 'Paid and unpaid work, counted together';
  const t42 = (g, col, row) => one('t42', (d) => nat(d, g) && d.measure === 'Minutes per person' && d.source_column.startsWith('age group / ' + col + ' /') && d.source_row === row, `t42 ${g} ${col} ${row}`);
  const PARTS = [['paid activities', 'Paid work'], ['unpaid activities:Non SNA activities', 'Unpaid domestic work and care'], ['unpaid activities: SNA activities', 'Unpaid production of goods']];
  plate('total-work', G4, {
    meta: { sub: 'Minutes per person per day of paid work and of unpaid work, by age group. Averages across everyone, including people who did none. The 15 to 29 group is a part of the 15 to 59 group, not a separate band.', kind: 'stackMinutes', explain: 'Paid work here is work the survey records as paid, a narrower idea than employment. Unpaid production of goods covers farming, fetching water and collecting fuel for the household’s own use; domestic work and care is cooking, cleaning and looking after people. Add the three and females work longer than males in every age group.' },
    build: (get) => ({ parts: PARTS.map(([, n]) => n), rows: [['all (6 years and above)', 'all ages'], ...AGES].flatMap(([col, n], i) => [F, M].map((g) => {
      const name = `${g === F ? 'Females' : 'Males'}, ${n}`;
      const total = get(t42(g, col, 'all unapid/paid acivities'), name + ' · all paid and unpaid work');
      return { name, gap: i > 0 && g === F, parts: PARTS.map(([row, pn]) => get(t42(g, col, row), `${name} · ${pn}`)), total };
    })) }),
    title: (v, s) => `Counting unpaid work, females aged six and above work ${v(s.rows[0].total)} minutes a day and males ${v(s.rows[1].total)}`,
    lead: (v, s) => ({ value: v(s.rows[0].total), unit: 'minutes', label: 'Paid and unpaid work, females, per person' }),
  });
  const PLACES = [['within premises of the dwelling unit of the household', 'At home'], ['outside premises of the dwelling unit of the household / in fixed location', 'Outside, at a fixed place'], ['outside premises of the dwelling unit of the household / in non-fixed location', 'Outside, moving about']];
  plate('where', G4, {
    meta: { sub: 'Among people who did paid work, and among people who did unpaid work, the share who did it in each place. Major activities only, age six and above.', kind: 'dumbbellPanels', explain: 'A person who worked both at home and outside is counted in both places, so the shares can add to more than 100%. A fixed place is a field, shop, office or factory; moving about is street vending, driving or carrying goods.' },
    build: (get) => ({ unit: 'pct', panels: [['paid activities', 'Paid work'], ['unpaid activities', 'Unpaid work']].map(([row, title]) => ({ title, items: PLACES.map(([col, n]) => pair(get, `${title}: ${n}`, (g) => one('t39', (d) => nat(d, g) && d.source_row === row && d.source_column === 'where the activity was performed / ' + col, `t39 ${row} ${col}`))).map((it) => ({ ...it, name: it.name.split(': ')[1] })) })) }),
    title: (v, s) => `${pc(v(s.panels[0].items[0].b))} of females doing paid work did some of it at home; ${pc(v(s.panels[0].items[0].a))} of males did`,
    lead: (v, s) => ({ value: v(s.panels[0].items[0].b), unit: 'pct', label: 'Females in paid work who worked at home' }),
  });

  // ================================================================ 5. who you are
  const G5 = 'Marriage, jobs, schooling and spending';
  const cut = (table, g, row, col, measure = null) => one(table, (d) => nat(d, g) && d.source_row === row && d.source_column.endsWith(' / ' + col) && (!measure || d.measure === measure), `${table} ${g} ${row} ${col}`);
  const MARITAL = [['never married', 'Never married'], ['currently married', 'Married'], ['widowed/ divorced/ separated', 'Widowed, divorced, separated']];
  plate('marriage', G5, {
    meta: { sub: 'Domestic work by marital status, age six and above. Width: share who did any during the day. Height: minutes among those who did. The area is the average across everyone.', kind: 'rects', explain: 'Never-married people include every child in the survey, so part of this gap is age. Even so, the change is far larger on the female side. Married males are more likely than never-married males to do some domestic work, but spend no longer on it.', perPerson: false },
    build: (get) => ({ panels: MARITAL.map(([col, n]) => {
      const side = (g) => ({ share: get(cut('t21', g, major(3), col, 'Participation rate'), `${n} · ${g === F ? 'Females' : 'Males'} · share who did it`), minutes: get(cut('t22', g, major(3), col), `${n} · ${g === F ? 'Females' : 'Males'} · minutes among them`) });
      return { name: n, b: side(F), a: side(M) };
    }) }),
    title: (v, s) => `${pc(v(s.panels[1].b.share))} of married females did domestic work during the day, for ${v(s.panels[1].b.minutes)} minutes; ${pc(v(s.panels[0].b.share))} of never-married females did, for ${v(s.panels[0].b.minutes)}`,
    lead: (v, s) => ({ value: v(s.panels[1].b.share), unit: 'pct', label: 'Married females who did domestic work' }),
  });
  const STATUS = [['self -employed (11,12,21)', 'Self-employed'], ['regular wage/ salaried employee (31)', 'Regular wage or salary'], ['casual labour (41,51)', 'Casual labour'], ['unemployed (81)', 'Unemployed'], ['attended educational institutions (91)', 'Students'], ['attended domestic duties (92, 93)', 'Domestic duties'], ['rentiers, pensioners, remittance recipients (94)', 'Pensioners and rentiers']];
  plate('status', G5, {
    meta: { sub: 'Domestic work by usual principal activity, age six and above. Left: share who did any during the day. Right: minutes among those who did.', kind: 'dumbbellPanels', explain: 'Usual status describes what a person mainly did over the past year, so it is a different measure from what they did on the interview day. A woman with a salaried job does less domestic work than one without, but still more than twice as much as a salaried man.' },
    build: (get) => ({ panels: [['t17', 'Did any domestic work', 'pct'], ['t18', 'Minutes, among those who did', 'minutes']].map(([table, title, unit]) => ({ title, unit, items: STATUS.map(([col, n]) => pair(get, `${n} (${unit === 'pct' ? 'share' : 'minutes'})`, (g) => cut(table, g, major(3), col))).map((it) => ({ ...it, name: it.name.replace(/ \((share|minutes)\)$/, '') })) })) }),
    title: (v, s) => { const r = s.panels[1].items[1]; return `Females with a regular salaried job still spend ${v(r.b)} minutes on domestic work on days they do it; salaried males spend ${v(r.a)}`; },
    lead: (v, s) => ({ value: v(s.panels[1].items[1].b), unit: 'minutes', label: 'Salaried females, domestic minutes among those who did it' }),
  });
  const EDU = [['not literate', 'Not literate'], ['literate / below primary', 'Below primary'], ['literate / primary', 'Primary'], ['literate / upper primary/ middle', 'Middle school'], ['literate / secondary', 'Secondary'], ['literate / higher secondary', 'Higher secondary'], ['literate / graduate and above', 'Graduate and above']];
  plate('education', G5, {
    meta: { sub: 'Share who did any employment work during the day, by level of education, age six and above.', kind: 'dumbbell', explain: 'For females the line falls and then rises, a U shape also seen in India’s employment surveys. The groups differ in age as well: children still in school sit in the middle categories, which pulls those shares down.' },
    build: (get) => ({ sortBy: 'none', unit: 'pct', items: EDU.map(([col, n]) => pair(get, n, (g) => cut('t29', g, major(1), col))) }),
    title: (v, s) => `Females’ employment falls from ${pc(v(s.items[0].b))} among those who cannot read to ${pc(v(s.items[5].b))} with higher secondary schooling, then rises to ${pc(v(s.items[6].b))} among graduates`,
    lead: (v, s) => ({ value: v(s.items[6].b), unit: 'pct', label: 'Female graduates who did employment work' }),
  });
  const FIFTHS = [['0-20', 'Lowest fifth'], ['20-40', 'Second fifth'], ['40-60', 'Middle fifth'], ['60-80', 'Fourth fifth'], ['80-100', 'Highest fifth']];
  plate('spending', G5, {
    meta: { sub: 'Share who did domestic work and care during the day, by household spending per person, age six and above. Fifths are ranked separately in villages and towns.', kind: 'dumbbellPanels', explain: 'Care falls steadily from the poorest fifth to the richest, and domestic work rises slightly. Poorer households tend to have more young children, which may explain part of the care gradient; this table cannot show it. Among females who did domestic work, the time spent barely changes across the fifths. Spending fifths are not income or wealth groups.' },
    build: (get) => ({ unit: 'pct', panels: [[3, 'Domestic work'], [4, 'Care']].map(([k, title]) => ({ title, items: FIFTHS.map(([col, n]) => pair(get, `${title}: ${n}`, (g) => cut('t25', g, major(k), col, 'Participation rate'))).map((it) => ({ ...it, name: it.name.split(': ')[1] })) })) }),
    title: (v, s) => { const c = s.panels[1].items; return `${pc(v(c[0].b))} of females in the poorest fifth did care work during the day; ${pc(v(c[4].b))} in the richest fifth did`; },
    lead: (v, s) => ({ value: v(s.panels[1].items[0].b), unit: 'pct', label: 'Females in the lowest fifth doing care' }),
  });
  const SOCIAL = [['ST', 'Scheduled Tribes'], ['SC', 'Scheduled Castes'], ['OBC', 'Other Backward Classes'], ['Others', 'Others']];
  plate('social', G5, {
    meta: { sub: 'By household social group, age six and above. Left: share who did any employment work during the day. Right: minutes of domestic work among those who did it.', kind: 'dumbbellPanels', explain: 'Each person is placed in the social group of the household head, as reported. Females in Scheduled Tribe households are the most likely to do employment work and spend the least time on domestic work when they do it. The groups also differ in where they live and how they earn, which this table does not separate.' },
    build: (get) => ({ panels: [['t33', 1, 'Did employment work', 'pct', 'Participation rate'], ['t34', 3, 'Domestic minutes, among those who did', 'minutes', null]].map(([table, k, title, unit, m]) => ({ title, unit, items: SOCIAL.map(([col, n]) => pair(get, `${title}: ${n}`, (g) => cut(table, g, major(k), col, m))).map((it) => ({ ...it, name: it.name.split(': ')[1] })) })) }),
    title: (v, s) => { const e = s.panels[0].items; return `${pc(v(e[0].b))} of females in Scheduled Tribe households did employment work during the day; ${pc(v(e[3].b))} in "Others" households did`; },
    lead: (v, s) => ({ value: v(s.panels[0].items[0].b), unit: 'pct', label: 'Scheduled Tribe females in employment work' }),
  });

  // ================================================================ 6. states
  const G6 = 'Across states';
  const STATES = { 'Andaman & N.Islands': ['AN', 'Andaman and Nicobar'], 'Andhra Pradesh': ['AP'], 'Arunachal Pradesh': ['AR'], Assam: ['AS'], Bihar: ['BR'], Chandigarh: ['CH'], Chhattisgarh: ['CG'], 'Dadra & Nagar Haveli & Daman & Diu': ['DH', 'Dadra, Daman and Diu'], Delhi: ['DL'], Goa: ['GA'], Gujarat: ['GJ'], Haryana: ['HR'], 'Himachal Pradesh': ['HP'], 'Jammu & Kashmir': ['JK', 'Jammu and Kashmir'], Jharkhand: ['JH'], Karnataka: ['KA'], Kerala: ['KL'], Ladakh: ['LA'], Lakshadweep: ['LD'], 'Madhya Pradesh': ['MP'], Maharashtra: ['MH'], Manipur: ['MN'], Meghalaya: ['ML'], Mizoram: ['MZ'], Nagaland: ['NL'], Odisha: ['OD'], Puducherry: ['PY'], Punjab: ['PB'], Rajasthan: ['RJ'], Sikkim: ['SK'], 'Tamil Nadu': ['TN'], Telangana: ['TS'], Tripura: ['TR'], 'Uttar Pradesh': ['UP'], Uttarakhand: ['UK'], 'West Bengal': ['WB'] };
  const stateName = (s) => STATES[s][1] ?? s;
  const t45 = (st, sex, what) => one('t45', (d) => d.state === st && d.sector === 'Combined' && d.age_group.startsWith('all') && d.source_column.startsWith(sex + ' / ' + what), `t45 ${st} ${sex} ${what}`);
  plate('state-map', G6, {
    meta: { sub: 'Share of the whole day that females aged six and above spend on unpaid domestic work and care, averaged over everyone. Rural and urban together.', kind: 'tileMap', explain: 'This is the measure India reports for the Sustainable Development Goals (indicator 5.4.1). Each tile is one state or union territory, the same size whatever its population. The next two charts rank the states and show how precise each estimate is.' },
    build: (get) => ({ india: get(t45('All INDIA', 'female', 'total'), 'All India · females'), tiles: Object.keys(STATES).map((st) => ({ iso: STATES[st][0], name: stateName(st), v: get(t45(st, 'female', 'total'), stateName(st) + ' · females') })) }),
    title: (v, s) => { const vals = s.tiles.map((t) => v(t.v)); return `Domestic work and care take ${pc(v(s.india))} of the average female day in India, from ${pc(Math.min(...vals))} to ${pc(Math.max(...vals))} across states`; },
    lead: (v, s) => ({ value: v(s.india), unit: 'pct', label: 'Share of the female day, All India' }),
  });
  plate('state-gap', G6, {
    meta: { sub: 'Share of the day spent on unpaid domestic work and care, females against males, age six and above. States ranked by the female share.', kind: 'dumbbell', explain: 'The male share is small everywhere. The states where men do the most, Nagaland, Arunachal Pradesh and Sikkim among them, are in the north-east, but even there women’s share is several times larger.' },
    build: (get) => ({ sortBy: 'b', unit: 'pct', ref: get(t45('All INDIA', 'female', 'total'), 'All India · females, reference'), items: Object.keys(STATES).map((st) => pair(get, stateName(st), (g) => t45(st, g.toLowerCase(), 'total'))) }),
    title: (v, s) => { const top = s.items.reduce((a, b) => v(b.a) > v(a.a) ? b : a); return `Men in ${top.name} spend the largest share of their day on domestic work and care, ${pc(v(top.a))}; women there spend ${pc(v(top.b))}`; },
    lead: (v, s) => { const top = s.items.reduce((a, b) => v(b.a) > v(a.a) ? b : a); return { value: v(top.a), unit: 'pct', label: `Males in ${top.name}` }; },
  });
  plate('state-range', G6, {
    meta: { sub: 'Share of the day females spend on unpaid domestic work alone, with a range of about two standard errors either side, computed from the published relative standard error. States ranked by the estimate.', kind: 'intervals', explain: 'A survey estimate comes with sampling error. Where two states’ ranges overlap, the survey cannot say which is higher. Small states and union territories have the widest ranges. The range covers sampling error only, not errors in recall or reporting.' },
    build: (get) => ({ india: get(t45('All INDIA', 'female', 'unpaid domestic'), 'All India · females · domestic work, share of day'), items: Object.keys(STATES).map((st) => ({
      name: stateName(st),
      v: get(t45(st, 'female', 'unpaid domestic'), stateName(st) + ' · females · domestic work, share of day'),
      rse: get(one('rse3_state', (d) => d.state === st && d.source_row.startsWith('Unpaid domestic') && d.source_column === 'rural+urban / female', `rse3 ${st}`), stateName(st) + ' · females · domestic work, relative standard error'),
    })) }),
    title: (v, s) => { const r = s.items.map((i) => ({ e: v(i.v), h: 1.96 * v(i.v) * v(i.rse) / 100 })).sort((a, b) => b.e - a.e); let n = 0; for (let k = 1; k < r.length; k++) if (r[k - 1].e - r[k - 1].h <= r[k].e + r[k].h) n++; return `In ${n} of ${r.length - 1} pairs of states next to each other in the ranking, the ranges overlap: the survey cannot say which is higher`; },
    lead: (v, s) => { const w = s.items.reduce((a, b) => v(b.rse) > v(a.rse) ? b : a); return { value: v(w.rse), unit: 'pct_rse', label: `Relative standard error, ${w.name}` }; },
  });

  // ================================================================ 7. how sure
  const G7 = 'What the survey can and cannot tell us';
  const WHO = [['self', 'The person themselves'], ['other household members', 'Another household member'], ['not a member of the household but closely associated with the household', 'Someone close, outside the household']];
  plate('proxy', G7, {
    meta: { sub: 'Who answered the questions about each person’s day, age six and above.', kind: 'dumbbell', explain: 'When someone else describes a person’s day, short or easily overlooked activities, a few minutes of care or a quick errand, are more likely to be missed. Males were more often described by someone else.' },
    build: (get) => ({ sortBy: 'none', unit: 'pct', items: WHO.map(([col, n]) => pair(get, n, (g) => one('t3', (d) => nat(d, g) && d.source_row === 'all' && d.source_column.endsWith(' / ' + col), `t3 ${g} ${col}`))) }),
    title: (v, s) => `${pc(v(s.items[0].b))} of females answered for themselves; ${pc(v(s.items[0].a))} of males did`,
    lead: (v, s) => ({ value: v(s.items[0].a), unit: 'pct', label: 'Males who answered for themselves' }),
  });
  const RSE = ['Employment and related activities', 'Production of goods for own final use', 'Unpaid domestic services for household members', 'Unpaid caregiving services for household members', 'Unpaid volunteer, trainee and other unpaid work', 'Learning', 'Socializing and communication, community participation and religious practice', 'Culture, leisure, mass-media and sports practices', 'Self-care and maintenance'];
  plate('precision', G7, {
    meta: { sub: 'Relative standard error of the all-India average minutes per person, by activity, age six and above. Higher means less precise.', kind: 'dumbbell', explain: 'A relative standard error of 1% means the sampling error is about one hundredth of the estimate. National averages for common activities are very precise. Rare activities, like volunteering, and activities only a few people of one sex do, like domestic work for men, are less so, and the error grows again for states and small groups.' },
    build: (get) => ({ sortBy: 'b', unit: 'pct_rse', items: RSE.map((row, k) => pair(get, majorShort[k], (g) => one('rse3_india', (d) => nat(d, g) && d.source_row === row && allAges(d), `rse3 ${row}`))) }),
    title: (v, s) => { const vol = s.items[4]; return `Volunteering is the least precise national estimate, with a relative standard error of ${pc(v(vol.b))} for females and ${pc(v(vol.a))} for males`; },
    lead: (v, s) => ({ value: v(s.items[4].b), unit: 'pct_rse', label: 'Relative standard error, volunteering, females' }),
  });

  // ---------------------------------------------------------------- facts per plate, for the facts sheet
  const plateFacts = Object.fromEntries(plates.map((p) => [p.id, {
    title: p.title, lead: p.lead,
    rows: p.rows.map((r) => ({ label: r.name, value: r.value, unit: r.unit, bundle: r.bundle, series: r.series, cell: r.cell })),
  }]));
  return { manifest, plates, facts, plateFacts, used, labels,
    summary: { workbooks: manifest.tables.length, sourceCells: manifest.sourceCells, canonicalCells: manifest.bundles.reduce((n, b) => n + b.series, 0), withheld: manifest.withheld, plates: plates.length, shownCells: [...used.values()].reduce((n, s) => n + s.size, 0) } };
}
