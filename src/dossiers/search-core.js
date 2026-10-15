import {validComparisonPolicy} from '../explore/model.js';
// src/dossiers/search-core.js: the site search engine, shared by the home page
// (src/dossiers/home.client.js) and the qc gate (scripts/qc.mjs), so the gate tests the search
// readers use. It reads only the static files scripts/search-index.mjs writes under /search/:
//
//   core.json    loaded when a reader starts to search (budget in docs/CONTRACT-render.md):
//                every guide, every plate (title and finding), every bundle (title, cut, guide,
//                where its every-cut rows live), every long-tail every-cut view, and the
//                manifest of the shards below.
//   t/<n>.json   token shards: { token: [row ids, gap- and run-coded] } for the words of every series
//                label and group, packed in token order; core.shards.tokens[n] is the first
//                token of shard n, so the shard holding a word is a binary search away.
//   r/<n>.json   row chunks: [label, group, latest, period, anchor, recent values] in global row
//                order; core.shards.rows[n] is the first row id of chunk n.
//
// A query runs on core.json at once (guides, charts, files) and then on the shards for series,
// fetching the token shards its words need and the row chunks its best rows sit in. Very common
// words ("total", "india") have no posting list (core.shards.frequent): they narrow rows already
// found by another word. Every word must match; for a series a word matches its label or group,
// or its bundle's title, cut, source or guide.

export const STOP = new Set(["a", "an", "and", "the", "of", "in", "on", "for", "to", "by", "at", "with", "from", "or", "as", "is", "its"]);
// plain-language words for what the series call something else
export const SYN = {
  inflation: ["price", "cpi", "wpi"], jobs: ["unemployment", "labour", "employment", "plfs"],
  rupee: ["usd", "inr", "exchange", "dollar"], dollar: ["usd"], growth: ["gdp", "gva"], factory: ["manufacturing", "iip", "factories"],
  factories: ["factory", "manufacturing"], college: ["enrolment", "aishe"], women: ["female", "gender", "woman"], woman: ["female", "women"],
  power: ["electricity"], account: ["accounts"], bank: ["banks"],
  // words readers type that the tables spell out (review-c, 2026-10: tried twenty real queries)
  forex: ["foreign", "fx"], msp: ["minimum"], heatwave: ["heat", "hot"], heat: ["hot", "temperature"],
  stunting: ["stunted"], wasting: ["wasted"], anaemia: ["anaemic", "anemia"], anemia: ["anaemia", "anaemic"],
  home: ["housing", "house"], salary: ["wage", "wages", "earnings"], wages: ["wage", "earnings"],
  monsoon: ["rainfall", "rain"], rainfall: ["rain"], poor: ["poverty"], loans: ["loan", "credit"],
  // a state's GDP is its GSDP; "prices" asks about inflation (datafix 2026-10-10)
  gdp: ["gsdp"], prices: ["price", "inflation", "cpi"], price: ["inflation", "cpi"],
};
export const MIN_PREFIX = 3;

/** Lower-cased words of a text, accents stripped, split on anything not a letter or digit. */
export function tokens(text) {
  return String(text ?? "").toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").split(/[^a-z0-9]+/).filter(Boolean);
}
/** The words a text is indexed under: tokens(), less "prices" where it names a valuation basis
 *  ("GSDP at current prices", "constant 2011-12 prices"): a reader searching "prices in bihar"
 *  wants inflation, not every rupee figure (datafix 2026-10-10). The label still reads in full. */
export function indexTokens(text) {
  const t = tokens(text);
  return t.filter((w, i) => !((w === "prices" || w === "price") && /^(current|constant|\d+)$/.test(t[i - 1] ?? "")));
}
/** Index of the last element of a sorted array that is <= x (0 if none). */
function floorIdx(arr, x) {
  let lo = 0, hi = arr.length - 1, ans = 0;
  while (lo <= hi) { const m = (lo + hi) >> 1; if (arr[m] <= x) { ans = m; lo = m + 1; } else hi = m - 1; }
  return ans;
}
// row ids as gaps, with a run of consecutive ids written as one negative number: [5, 3, -40]
// is 5, 8 and the 40 ids after 8 (decodeIds below). Rows of one bundle sit together.
export function encodeIds(ids) {
  const out = [];
  let prev = -1;
  for (let i = 0; i < ids.length; ) {
    let j = i;
    while (j + 1 < ids.length && ids[j + 1] === ids[j] + 1) j++;
    out.push(ids[i] - prev);
    if (j > i) out.push(-(j - i));
    prev = ids[j];
    i = j + 1;
  }
  return out;
}
// row ids as gaps from the previous id (the first from -1), a negative number -k meaning the k ids
// after the last one (scripts/search-index.mjs encodeIds)
export function decodeIds(d) {
  const out = [];
  let v = -1;
  for (const x of d) {
    if (x < 0) for (let k = 0; k < -x; k++) out.push(++v);
    else { v += x; out.push(v); }
  }
  return out;
}

/** The words of a query, each with the token forms that satisfy it. A word still being typed
 *  (the last, with no space after it) matches as a prefix once it has MIN_PREFIX letters;
 *  finished words match whole, with a plural or singular form and the synonyms above. */
export function parseQuery(q) {
  // the same words as the index: "prices" after "current" or "constant" names a valuation basis
  const raw = indexTokens(q);
  if (!raw.length) return [];
  const typing = !/\s$/.test(q);
  let words = raw.map((w, i) => ({ w, prefix: typing && i === raw.length - 1 && w.length >= MIN_PREFIX }));
  const content = words.filter((x) => !STOP.has(x.w));
  if (content.length) words = content;
  return words.map(({ w, prefix }) => {
    const forms = new Set([w, ...(SYN[w] ?? [])]);
    // a plural or singular of the word and of each synonym ("inflation" -> "price" -> "prices")
    if (!prefix) for (const f of [...forms]) { if (f.length > 3 && f.endsWith("s")) forms.add(f.slice(0, -1)); else forms.add(f + "s"); }
    return { w, prefix, forms: [...forms] };
  });
}
const tokenMatches = (word, t) => word.forms.some((f) => (word.prefix && f === word.w ? t.startsWith(f) : t === f));

// Quantity intent is a ranking preference, never a filter or a unit conversion. Ambiguous
// financial words alone do not choose an intent; explicit shares/index/growth override pay.
export function rankUnitGroups(unit) {
  const u=String(unit??'').toLowerCase();
  if(/^(inr|usd|eur|gbp|cad|aud|jpy)(_|$)/.test(u))return ['money'];
  if(['count','persons','people','number','count_thousands','thousand_persons','million_persons'].includes(u))return ['count'];
  if(u==='index'||u.endsWith('_index'))return ['index'];
  if(/^pct_yoy(?:_|$)/.test(u))return ['inflation','change','relative'];
  if(/^(pct|percent|percentage|per_1000|ratio|multiple)(_|$)/.test(u))return ['relative',...(['pct','percent','percentage','pct_growth','pct_change'].includes(u)?['change']:[])];
  return [];
}
export function unitIntent(words,q='') {
  const names=new Set(words.map(w=>w.w));
  if(/%/.test(q)||['percentage','percent','ratio','proportion'].some(w=>names.has(w))||(names.has('share')&&!['price','prices','stock'].some(w=>names.has(w))))return 'relative';
  if(names.has('count')||names.has('number'))return 'count';
  if(names.has('index'))return 'index';
  if(names.has('inflation'))return 'inflation';
  if(names.has('growth'))return 'change';
  if((names.has('worker')||names.has('workers'))&&(names.has('wage')||names.has('salary'))&&!['earnings','wages','salaries','amount','pay'].some(w=>names.has(w))&&!/[₹$]/.test(q))return null;
  if(/[₹$]/.test(q)||['wage','wages','salary','salaries','earnings'].some(w=>names.has(w)))return 'money';
  return null;
}

/** A search over the files above. `load(path)` returns the parsed JSON of /search/<path>. */
export function expectedScheduleContext(quality){
  if(quality?.canInterpret!==true||quality.observationKind!=='expected-schedule')return null;
  if(quality.canCompare!==false||!quality.review?.sourceVersion||!Object.values(quality.binding?.records||{}).some(fp=>/^[a-f0-9]{64}$/.test(fp)))throw Error('Expected source policy is incomplete. Refresh or retry after review.');
  const known=quality.forecastAsOfStatus==='known',date=quality.forecastAsOfDate;
  if(known&&(!/^\d{4}-\d{2}-\d{2}$/.test(date||'')||!Number.isFinite(Date.parse(date+'T00:00:00Z'))||new Date(date+'T00:00:00Z').toISOString().slice(0,10)!==date))throw Error('Expected source snapshot date is invalid');
  return {label:'Expected schedule',asOf:known?'Forecast as-of '+date:'Forecast as-of unknown',reference:quality.referencePeriod||''};
}
export function createSearch(core, load, { expectedQualityVersion } = {}) {
  if(expectedQualityVersion&&core.quality?.version!==expectedQualityVersion)throw new Error('Search and source-quality policy belong to different releases. Refresh the page.');
  if(core.quality){
    const q=core.quality,valid=id=>Object.hasOwn(q.policies??{},id)&&validComparisonPolicy(q.policies[id]);
    if(!valid(q.default)||Object.values(q.bundles??{}).some(id=>!valid(id))||Object.keys(q.rowOverrides??{}).some(id=>!valid(id)))throw new Error('Search source-quality policy is incomplete. Refresh or retry after the release finishes.');
  }
  const { guides, plates, bundles, views, shards } = core;
  const frequent = new Set(shards.frequent);
  const lexicon = shards.lexicon ?? null, known = lexicon ? new Set(lexicon) : null;
  const hasForm = (f, prefix) => {
    if (!known) return true;
    if (!prefix) return known.has(f);
    let i = floorIdx(lexicon, f); if (lexicon[i] < f) i++;
    return lexicon[i]?.startsWith(f) ?? false;
  };
  // A conservative spelling suggestion: one edit (including adjacent transposition),
  // only when the vocabulary offers exactly one correction. Never replace valid cuts/units.
  const oneEdit = (a,b) => {
    if (Math.abs(a.length-b.length)>1) return false;
    if (a.length===b.length) {
      const d=[]; for(let i=0;i<a.length;i++)if(a[i]!==b[i])d.push(i);
      return d.length===1||(d.length===2&&d[1]===d[0]+1&&a[d[0]]===b[d[1]]&&a[d[1]]===b[d[0]]);
    }
    if(a.length>b.length)[a,b]=[b,a];
    let i=0;while(i<a.length&&a[i]===b[i])i++;
    return a.slice(i)===b.slice(i+1);
  };
  function suggest(q) {
    if (!lexicon) return null;
    let result=q;
    for(const word of parseQuery(q)){
      if(word.w.length<5||word.forms.some(f=>hasForm(f,word.prefix&&f===word.w)))continue;
      const hits=lexicon.filter(t=>/^[a-z]+$/.test(t)&&oneEdit(word.w,t));
      if(hits.length===1)result=result.replace(new RegExp(`\\b${word.w}\\b`,'i'),hits[0]);
    }
    return result===q?null:result;
  }
  const tShards = new Map(), rChunks = new Map();
  // Bounded LRU of shared requests. Failed loads are evicted so going back online can recover.
  // Cancellation belongs to the query, not these promises: another query may need the same file.
  const cached = (cache, i, file, cap) => {
    if (cache.has(i)) { const p = cache.get(i); cache.delete(i); cache.set(i, p); return p; }
    const p = Promise.resolve().then(() => load(file)).catch(e => { if (cache.get(i) === p) cache.delete(i); throw e; });
    cache.set(i, p);
    while (cache.size > cap) cache.delete(cache.keys().next().value);
    return p;
  };
  const shard = (i) => cached(tShards, i, `t/${shards.filesT?.[i] ?? i + '.json'}`, 24);
  const chunk = (i) => cached(rChunks, i, `r/${shards.filesR?.[i] ?? i + '.json'}`, 48);
  const check = signal => { if (signal?.aborted) throw new DOMException('Search cancelled', 'AbortError'); };
  const starts = bundles.map((b) => b[4]);
  const qOverrides=new Map();
  for(const [policy,ids] of Object.entries(core.quality?.rowOverrides??{}))for(const id of decodeIds(ids))qOverrides.set(id,policy);
  const qualityOf = (bundle,id) => {
    const q=core.quality;
    return q?.policies[qOverrides.get(id)??q.bundles[bundle]??q.default]??null;
  };
  const bundleOf = (row) => floorIdx(starts, row);
  const unitRanges=new Map();
  const preferred = (id,group) => {
    if(!group||!core.ranking?.units?.[group])return false;
    if(!unitRanges.has(group)) {
      let last=-1;const ranges=[];
      for(const code of core.ranking.units[group]) {
        if(code>=0){last+=code;ranges.push([last,last]);}
        else {last-=code;ranges.at(-1)[1]=last;}
      }
      unitRanges.set(group,ranges);
    }
    const ranges=unitRanges.get(group);let lo=0,hi=ranges.length-1;
    while(lo<=hi){const m=(lo+hi)>>1;if(id<ranges[m][0])hi=m-1;else if(id>ranges[m][1])lo=m+1;else return true;}
    return false;
  };
  const hay = (parts) => indexTokens(parts.filter(Boolean).join(" "));
  const gTok = guides.map((g) => hay([g[1], g[2]]));
  const bTok = bundles.map((b) => [...new Set([...hay([b[1], b[2], b[7]]), ...(b[3] >= 0 ? hay([guides[b[3]][1]]) : [])])]);

  // datafix (2026-10-10): a state's own measures (scripts/search-index.mjs core.own) lead when a
  // query names a state: "inflation in kerala" opens on Kerala's retail inflation, not on the
  // farm-labourer index for Kerala. An own row gains 2, ordinary rows scoring 1 or 2 a word, so it
  // outranks a narrower row that matches the query the same way; a measure the profile shows at a
  // glance gains a quarter more, the weight of one extra word in a label (series() below), which
  // settles a tie between two of a state's own measures without overriding a closer label
  // ("bank deposits maharashtra": deposits, not the credit-deposit ratio shown at a glance).
  const ownW = new Map();
  for (const id of decodeIds(core.own?.other ?? [])) ownW.set(id, 2);
  for (const id of decodeIds(core.own?.glance ?? [])) ownW.set(id, 2.25);
  const ownBundles = new Set([...ownW.keys()].map((id) => floorIdx(starts, id)));
  // what a bundle is about: its title, cut and guide (not its source: "Labour Bureau" is no topic)
  const bTopic = bundles.map((b) => new Set([...hay([b[1], b[2]]), ...(b[3] >= 0 ? hay([guides[b[3]][1], guides[b[3]][2]]) : [])]));
  const pNames = (core.profiles ?? []).map((x) => [x[1], ...String(x[2] ?? "").split(" | ")].map((n) => tokens(n).filter((t) => !STOP.has(t))).filter((nt) => nt.length));
  /** The state profile a query names, if any: { i, nameWords (the query words its name uses), rest (the others) }. */
  function stateIn(words) {
    let best = null;
    pNames.forEach((names, i) => {
      for (const nt of names) {
        if (!nt.every((t) => words.some((w) => tokenMatches(w, t)))) continue;
        const used = words.filter((w) => nt.some((t) => tokenMatches(w, t)));
        if (!best || used.length > best.nameWords.length) best = { i, nameWords: used, rest: words.filter((w) => !used.includes(w)) };
      }
    });
    return best;
  }
  // a word is a topic when a guide or a bundle that holds a state's own measure speaks of it
  const isTopic = (w) => gTok.some((g) => g.some((t) => tokenMatches(w, t))) || [...ownBundles].some((bi) => [...bTopic[bi]].some((t) => tokenMatches(w, t)));

  // ----- instant: guides, charts and files, from core.json alone
  function quick(q, { limit = 6 } = {}) {
    const words = parseQuery(q);
    if (!words.length) return { guides: [], plates: [], files: [] };
    const score = (title, all) => {
      let s = 0;
      for (const w of words) {
        if (title.some((t) => tokenMatches(w, t))) s += 2;
        else if (all.some((t) => tokenMatches(w, t))) s += 1;
        else return 0;
      }
      return s;
    };
    const rank = (items) => items.filter((x) => x.s > 0).sort((a, b) => b.s - a.s || a.i - b.i).slice(0, limit);
    const g = rank(guides.map((x, i) => ({ i, s: score(tokens(x[1]), gTok[i]), href: `/guides/${x[0]}/`, title: x[1], note: x[2] })));
    const p = rank(plates.map((x, i) => ({ i, s: score(tokens(x[2]), [...tokens(x[2]), ...tokens(x[3]), ...gTok[x[0]]]),
      href: `/guides/${guides[x[0]][0]}/#${x[1]}`, title: x[2], note: guides[x[0]][1] })));
    const files = rank([
      ...bundles.map((b, i) => {const quality=qualityOf(b[0]);return { i, s: score(tokens(b[1]), bTok[i]), href: quality?.canInterpret===false&&b[8]?`/explore/?${new URLSearchParams({series:b[0]+':'+b[8]})}`:(b[6][0]?.[1] ?? `/data/${b[0]}.csv`), title: quality?.canInterpret===false?(quality.publicTitle??'Source file under review'):b[1],
        note: [quality?.canInterpret===false?'Source mapping under review':null,b[3] >= 0 ? guides[b[3]][1] : null, b[2], `${b[5].toLocaleString("en-IN")} series`].filter(Boolean).join(", "), slug: b[0],quality };}),
      ...views.map((v, i) => ({ i: bundles.length + i, s: score(tokens(v[1]), [...tokens(v[1]), ...gTok[v[0]]]), href: v[2], title: v[1],
        note: `${guides[v[0]][1]}, every cut, ${v[3].toLocaleString("en-IN")} series` })),
    ]);
    // profiles (lb/profiles): a unit whose name or a spelling of it the query's words make up
    // (all of them: "orissa"; lead: true) or contain ("inflation in kerala")
    const st = (core.profiles ?? []).map((x, i) => {
      const names = [x[1], ...String(x[2] ?? "").split(" | ")].map((n) => tokens(n).filter((t) => !STOP.has(t)));
      let best = 0, lead = false;
      for (const nt of names) {
        if (!nt.length) continue;
        const hit = words.filter((w) => nt.some((t) => tokenMatches(w, t))).length;
        const covers = nt.every((t) => words.some((w) => tokenMatches(w, t)));
        if (covers && hit > best) { best = hit; lead = hit === words.length; }
      }
      // a state and a topic the site covers ("inflation in kerala"): the profile leads too
      if (best && !lead) { const named = stateIn(words); if (named?.i === i && named.rest.length && named.rest.every(isTopic)) lead = true; }
      return { i, s: best, lead, href: `/states/${x[0]}/`, title: x[1], note: "State profile" };
    }).filter((x) => x.s > 0).sort((a, b) => b.lead - a.lead || b.s - a.s || a.i - b.i).slice(0, 3);
    return { guides: g, plates: p, files, states: st };
  }

  // ----- series: token shards, then the row chunks of the best rows
  async function postingsFor(word) {
    const want = new Set();
    let loose = false;
    for (const f of word.forms) {
      const isPrefix = word.prefix && f === word.w;
      if (!hasForm(f, isPrefix)) continue;
      const a = floorIdx(shards.tokens, f), b = isPrefix ? floorIdx(shards.tokens, f + "￿") : a;
      for (let i = a; i <= b; i++) want.add(i);
    }
    const ids = [];
    const loaded = await Promise.all([...want].map(shard));
    for (const s of loaded) {
      for (const [t, d] of Object.entries(s)) if (tokenMatches(word, t)) for (const id of decodeIds(d)) ids.push(id);
    }
    for (const t of frequent) if (tokenMatches(word, t)) loose = true;
    return { ids: [...new Set(ids)].sort((x, y) => x - y), loose };
  }
  const rowsOfBundles = (bs) => bs.flatMap((bi) => Array.from({ length: bundles[bi][5] }, (_, k) => bundles[bi][4] + k));

  /** Every row matching the query, before the frequent-word check: { words, ids (ranked), score, deferred } */
  async function candidates(q, { signal } = {}) {
    check(signal);
    const words = parseQuery(q);
    if (!words.length) return null;
    // a state named in another spelling ("Orissa", "Pondicherry") finds the rows that use its name
    const named0 = stateIn(words);
    if (named0) { const canon = tokens(core.profiles[named0.i][1]).filter((t) => !STOP.has(t)); for (const w of named0.nameWords) w.forms = [...new Set([...w.forms, ...canon])]; }
    const per = await Promise.all(words.map(async w => {
      const { ids, loose } = await postingsFor(w);
      check(signal);
      const ctx = new Set(bundles.map((_, i) => i).filter((i) => bTok[i].some((t) => tokenMatches(w, t))));
      return { w, ids: new Set(ids), list: ids, loose, ctx };
    }));
    // seed: the word with the fewest rows of its own; a word that only frequent tokens or bundle
    // context satisfy cannot seed (it would list whole files), unless every word is like that
    const size = (p) => p.list.length + [...p.ctx].reduce((a, i) => a + bundles[i][5], 0);
    const seeds = per.filter((p) => p.list.length).sort((a, b) => size(a) - size(b));
    if (!seeds.length) return { words, ids: [], score: new Map(), deferred: [], tooBroad: per.some((p) => p.loose) };
    const seed = seeds[0];
    const pool = [...new Set([...seed.list, ...rowsOfBundles([...seed.ctx])])];
    const score = new Map();
    const deferred = [];
    const keep = [];
    const named = ownW.size ? named0 : null;
    const intent=unitIntent(words,q);
    let scanned = 0;
    for (const r of pool) {
      if (signal && ++scanned % 16384 === 0) { await new Promise(resolve => setTimeout(resolve, 0)); check(signal); }
      const bi = bundleOf(r);
      // the boost needs the topic words in the row's label or in what its bundle is about
      const own = named && ownW.has(r) && named.rest.every((w) => per.find((p) => p.w === w)?.ids.has(r) || [...bTopic[bi]].some((t) => tokenMatches(w, t)));
      let s = own ? ownW.get(r) : 0, ok = true, wait = false;
      for (const p of per) {
        if (p.ids.has(r)) s += 2;
        else if (p.ctx.has(bi)) s += 1;
        else if (p.loose) { s += 2; wait = true; }
        else { ok = false; break; }
      }
      if (!ok) continue;
      if(preferred(r,intent))s+=4;
      score.set(r, s); keep.push(r);
      if (wait) deferred.push(r);
    }
    keep.sort((a, b) => score.get(b) - score.get(a) || a - b);
    return { words, ids: keep, score, deferred: new Set(deferred), looseWords: per.filter((p) => p.loose && !p.list.length).map((p) => p.w) };
  }
  async function rowsAt(ids) {
    const out = new Map();
    const byChunk = new Map();
    for (const r of ids) { const c = floorIdx(shards.rows, r); if (!byChunk.has(c)) byChunk.set(c, []); byChunk.get(c).push(r); }
    await Promise.all([...byChunk].map(async ([c, rs]) => { const data = await chunk(c); for (const r of rs) out.set(r, data[r - shards.rows[c]]); }));
    return out;
  }
  // a deferred row passes when its own label or group carries each frequent word it relied on
  const passes = (row, words) => { const t = indexTokens(row[0] + " " + row[1]); return words.every((w) => t.some((x) => tokenMatches(w, x))); };

  /** The best `limit` series, fetching at most `maxChunks` row chunks. */
  async function series(q, { limit = 8, maxChunks = 6, signal, onCandidates } = {}) {
    const c = await candidates(q, { signal });
    check(signal);
    if (!c || !c.ids.length) return { rows: [], total: 0, tooBroad: c?.tooBroad ?? false };
    if(onCandidates) {
      const seen=new Set(), hits=[];
      for(const id of c.ids.slice(0,128)) {
        const bundle=bundles[bundleOf(id)];
        if(qualityOf(bundle[0],id)?.canInterpret===false)continue;
        const g=bundle[3];
        if(g<0||seen.has(g))continue;
        seen.add(g);hits.push({href:`/guides/${guides[g][0]}/`,title:guides[g][1],note:guides[g][2]});
        if(hits.length===3)break;
      }
      onCandidates({guides:hits,total:c.ids.length});
    }
    const looseWords = c.words.filter((w) => c.looseWords.includes(w.w));
    const picked = [], chunksUsed = new Set();
    for (const r of c.ids) {
      const ch = floorIdx(shards.rows, r);
      if (!chunksUsed.has(ch) && chunksUsed.size >= maxChunks) continue;
      chunksUsed.add(ch);
      picked.push(r);
      if (picked.length >= limit * 8) break;
    }
    const data = await rowsAt(picked);
    check(signal);
    const words = c.words;
    const out = [];
    for (const r of picked) {
      const row = data.get(r);
      if (c.deferred.has(r) && !passes(row, looseWords)) continue;
      const lt = indexTokens(row[0]);
      const inLabel = words.filter((w) => lt.some((t) => tokenMatches(w, t))).length;
      // a label made of the query's words and little else ranks first ("repo rate": "Policy repo rate")
      const extra = lt.filter((t) => !STOP.has(t) && !words.some((w) => tokenMatches(w, t))).length;
      // Long truthful qualifiers must not lose to a short label for another quantity.
      out.push({ id: r, row, rank: c.score.get(r) + inLabel - Math.min(extra / 4,1) - Math.min(row[0].length / 300,.25) });
    }
    out.sort((a, b) => b.rank - a.rank || a.id - b.id);
    return { rows: out.slice(0, limit).map(({ id, row }) => describe(id, row)), total: c.ids.length, approx: c.deferred.size > 0 };
  }
  /** Where a row lives: its guide, its every-cut page and the anchor of its row there. */
  function describe(id, row) {
    const bi = bundleOf(id), b = bundles[bi];
    const off = id - b[4];
    let url = null;
    for (const [o, u] of b[6]) if (o <= off) url = u;
    const identity = `${b[0]}:${row[4]}`;
    const guideHref = url ? `${url}#${row[4]}` : `/data/${b[0]}.csv`;
    const quality=qualityOf(b[0],id),blocked=quality?.canInterpret===false,expected=expectedScheduleContext(quality);
    return { identityVersion: 1, identity, explorerHref: `/explore/?${new URLSearchParams({series:identity})}`, guideHref,
      label: blocked?(row[6]??quality.publicTitle??'Source record under review'):row[0], originalLabel:row[0],quality,
      group: row[1], latest: blocked?null:row[2], period: row[3], recent: blocked||expected?[]:(row[5] ?? []),...(expected?{expectedSchedule:expected}:{}), bundle: b[0], file: b[1],
      guide: b[3] >= 0 ? guides[b[3]][1] : null, href: guideHref };
  }
  return { quick, series, candidates, rowsAt, describe, passes, bundleOf, stateIn, suggest };
}
