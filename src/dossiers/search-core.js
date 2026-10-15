import {validComparisonPolicy} from '../explore/model.js';
// src/dossiers/search-core.js: the site search engine, shared by the home page
// (src/dossiers/home.client.js), the explorer and the gates (scripts/qc.mjs, scripts/perf-search.mjs),
// so the gates test the search readers use. It reads the static files src/dossiers/search-pack.js
// lays out (index v2; scripts/search-index.mjs writes them under /search/):
//
//   core.json    loaded when a reader is about to search, a fixed size whatever the catalogue:
//                every guide, chart, every-cut view and state profile, the quality policies, and
//                per bundle only its guide and row count
//   t/, r/, b/, u/, lex   token shards (row and bundle postings), row chunks, bundle records,
//                quantity groups and the vocabulary, each fetched only when a query needs it
//
// A query answers at once from the core (guides, charts, views, profiles), then from the shards:
// the token shards its words need give the matching rows and files, and the row chunks and bundle
// records of the best rows give what the reader sees. Very common words ("total", "india") have
// no posting list (core.shards.frequent): they narrow rows already found by another word. Every
// word must match; for a series a word matches its label or group, or its bundle's title, cut,
// source or guide.

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
  // the accounts publish a balance; readers say deficit or surplus (perf-search held-out set, 2026-10-15)
  deficit: ["balance"], surplus: ["balance"],
};
export const MIN_PREFIX = 3;
// labels that speak for the whole country or a whole total (series() prefers them when no place is named)
let PROMINENCE = Number(globalThis.process?.env?.ATLAS_SEARCH_PROMINENCE ?? 0.5);
const NATIONAL = /\b(all[- ]india|india)\b/i, TOTAL = /\b(total|all)\b/i;

/** The reader's list, in order: a state profile the query names, then a guide every word of the
 *  query names (a topic query opens on its guide), then the series, then guides and charts,
 *  other state profiles and whole files. The home page renders exactly this; perf-search judges it. */
export function layout(quick, series) {
  const states = quick.states ?? [];
  const leadGuide = quick.guides[0]?.strong ? [quick.guides[0]] : [];
  // with no guide to lead, a chart whose title holds every word leads, unless a series label is
  // the query itself ("repo rate": the policy repo rate, with its value, beats a chart about it)
  // (decided once the series are in, so the list does not reorder under the reader's finger)
  const leadChart = !leadGuide.length && series?.rows && !series.rows[0]?.exact ? quick.plates.filter((p) => p.strong).slice(0, 1) : [];
  const top = [...quick.guides.filter((g) => !leadGuide.includes(g)).slice(0, 1).map((g) => ({ ...g, kind: "Guide" })), ...quick.plates.filter((p) => !leadChart.includes(p)).slice(0, 3).map((p) => ({ ...p, kind: "Chart" }))].slice(0, 3);
  return [
    { kind: "state", items: states.filter((x) => x.lead) },
    { kind: "guide", items: [...leadGuide.map((g) => ({ ...g, kind: "Guide" })), ...leadChart.map((p) => ({ ...p, kind: "Chart" }))] },
    { kind: "series", items: series?.rows?.slice(0, 6) ?? [] },
    { kind: "top", items: top },
    { kind: "states", items: states.some((x) => x.lead) ? [] : states },
    { kind: "files", items: (series?.files ?? quick.files).slice(0, 3) },
  ];
}

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
    // a plural or singular of the word and of each synonym ("inflation" -> "price" -> "prices").
    // While a word is being typed it matches as a prefix, which covers its own plural; its
    // synonyms are whole words, so they take their plurals either way.
    for (const f of [...forms]) { if (prefix && f === w) continue; if (f.length > 3 && f.endsWith("s")) forms.add(f.slice(0, -1)); else forms.add(f + "s"); }
    return { w, prefix, forms: [...forms] };
  });
}
const tokenMatches = (word, t) => word.forms.some((f) => (word.prefix && f === word.w ? t.startsWith(f) : t === f));
// the word itself, as typed, or its plural or singular (not a synonym)
const own = (word, t) => (word.prefix ? t.startsWith(word.w) : t === word.w || t === word.w + "s" || (word.w.endsWith("s") && t === word.w.slice(0, -1)));

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
  if (core.v !== 2) throw new Error('Search index is from an older release. Refresh the page.');
  if(expectedQualityVersion&&core.quality?.version!==expectedQualityVersion)throw new Error('Search and source-quality policy belong to different releases. Refresh the page.');
  if(core.quality){
    const q=core.quality,valid=id=>Object.hasOwn(q.policies??{},id)&&validComparisonPolicy(q.policies[id]);
    if(!valid(q.default)||Object.values(q.bundles??{}).some(id=>!valid(id))||Object.keys(q.rowOverrides??{}).some(id=>!valid(id)))throw new Error('Search source-quality policy is incomplete. Refresh or retry after the release finishes.');
  }
  const { guides, plates, views, shards } = core;
  const file = (name) => `${name}${core.rel ? "." + core.rel : ""}.json`;
  const counts = core.bundles.count, bGuide = core.bundles.guide;
  const starts = []; { let acc = 0; for (const n of counts) { starts.push(acc); acc += n; } }
  const frequent = new Set(shards.frequent);
  const bundleOf = (row) => floorIdx(starts, row);

  // Bounded LRU of shared requests. Failed loads are evicted so going back online can recover.
  // Cancellation belongs to the query, not these promises: another query may need the same file.
  const cached = (cache, i, name, cap) => {
    if (cache.has(i)) { const p = cache.get(i); cache.delete(i); cache.set(i, p); return p; }
    const p = Promise.resolve().then(() => load(name)).catch(e => { if (cache.get(i) === p) cache.delete(i); throw e; });
    cache.set(i, p);
    while (cache.size > cap) cache.delete(cache.keys().next().value);
    return p;
  };
  const tShards = new Map(), rChunks = new Map(), bFiles = new Map(), uFiles = new Map(), lexFile = new Map();
  const shard = (i) => cached(tShards, i, file(`t/${i}`), 24);
  const chunk = (i) => cached(rChunks, i, file(`r/${i}`), 48);
  const bfile = (i) => cached(bFiles, i, file(`b/${i}`), 32);
  const check = signal => { if (signal?.aborted) throw new DOMException('Search cancelled', 'AbortError'); };
  // bundle records ([slug, title, cut, guide, start, count, segs, ctx, reviewAnchor?]), fetched for
  // the bundles a result needs; a few thousand short arrays at most, so kept once loaded
  const recs = new Map();
  async function bundlesAt(bis) {
    const need = [...new Set(bis.filter((bi) => !recs.has(bi)).map((bi) => Math.floor(bi / shards.bpf)))];
    await Promise.all(need.map(async (f) => { (await bfile(f)).forEach((r, k) => recs.set(f * shards.bpf + k, r)); }));
  }
  const rec = (bi) => { const r = recs.get(bi); if (!r) throw new Error(`search: bundle ${bi} not loaded`); return r; };

  const qOverrides=new Map();
  for(const [policy,ids] of Object.entries(core.quality?.rowOverrides??{}))for(const id of decodeIds(ids))qOverrides.set(id,policy);
  const qualityOf = (bi,id) => { const q=core.quality; return q?.policies[qOverrides.get(id)??q.bundles?.[bi]??q.default]??null; };

  // quantity groups: the rows of one group, as id ranges, fetched when a query states an intent
  const unitRanges=new Map();
  async function unitGroup(group) {
    if(!group||!shards.units?.includes(group))return null;
    if(!unitRanges.has(group)) unitRanges.set(group, cached(uFiles, group, file(`u/${group}`), 8).then((codes) => {
      let last=-1;const ranges=[];
      for(const code of codes){ if(code>=0){last+=code;ranges.push([last,last]);} else {last-=code;ranges.at(-1)[1]=last;} }
      return ranges;
    }).catch((e) => { unitRanges.delete(group); throw e; }));
    return unitRanges.get(group);
  }
  const inRanges = (ranges, id) => { let lo=0,hi=ranges.length-1; while(lo<=hi){const m=(lo+hi)>>1;if(id<ranges[m][0])hi=m-1;else if(id>ranges[m][1])lo=m+1;else return true;} return false; };

  const hay = (parts) => indexTokens(parts.filter(Boolean).join(" "));
  // A guide answers to its title, its formal name (registry crumbTitle: "Consumer Price Index"),
  // its slug and the initials of its formal name ("cpi", "iip"); its blurb is weaker evidence.
  const initials = (t) => { const w = String(t ?? "").split(/[^A-Za-z]+/).filter((x) => x && !STOP.has(x.toLowerCase()) && /^[A-Z]/.test(x)); return w.length >= 3 ? w.map((x) => x[0]).join("").toLowerCase() : null; };
  const gTitle = guides.map((g) => [...new Set([...hay([g[1], g[3]]), ...tokens(g[0]), ...[initials(g[3]), initials(g[1])].filter(Boolean)])]);
  const gTok = guides.map((g, i) => [...new Set([...gTitle[i], ...hay([g[2]])])]);

  // datafix (2026-10-10): a state's own measures (core.own) lead when a query names a state:
  // "inflation in kerala" opens on Kerala's retail inflation, not on the farm-labourer index for
  // Kerala. An own row gains 2, ordinary rows scoring 1 or 2 a word, so it outranks a narrower
  // row that matches the query the same way; a measure the profile shows at a glance gains a
  // quarter more, the weight of one extra word in a label (series() below), which settles a tie
  // between two of a state's own measures without overriding a closer label.
  const ownW = new Map();
  for (const id of decodeIds(core.own?.other ?? [])) ownW.set(id, 2);
  for (const id of decodeIds(core.own?.glance ?? [])) ownW.set(id, 2.25);
  // what an own measure's bundle is about: its title, cut and guide (core.ownTopics)
  const bTopic = new Map(Object.entries(core.ownTopics ?? {}).map(([bi, t]) => [+bi, new Set(t)]));
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
  const isTopic = (w) => gTok.some((g) => g.some((t) => tokenMatches(w, t))) || [...bTopic.values()].some((ts) => [...ts].some((t) => tokenMatches(w, t)));

  // ----- instant: guides, charts, every-cut views and state profiles, from core.json alone
  function quick(q, { limit = 6 } = {}) {
    const words = parseQuery(q);
    if (!words.length) return { guides: [], plates: [], files: [], states: [] };
    const score = (title, all) => {
      let s = 0;
      for (const w of words) {
        // the word as typed (or its plural) in the title counts more than a synonym of it there
        if (title.some((t) => tokenMatches(w, t))) s += title.some((t) => own(w, t)) ? 2 : 1.75;
        else if (all.some((t) => tokenMatches(w, t))) s += 1;
        else return 0;
      }
      return s;
    };
    const rank = (items) => items.filter((x) => x.s > 0).sort((a, b) => b.s - a.s || a.i - b.i).slice(0, limit);
    // a guide needs at least one word in its title-level names (a blurb that mentions rupees does not
    // make a guide about the rupee); one with every word there is a strong answer and leads
    const g = rank(guides.map((x, i) => {
      const s = score(gTitle[i], gTok[i]), titled = words.filter((w) => gTitle[i].some((t) => tokenMatches(w, t))).length;
      return { i, s: titled ? s : 0, strong: titled === words.length, href: `/guides/${x[0]}/`, title: x[1], note: x[2] };
    }));
    // a chart in a guide that is itself about the query's words ranks before the same match in a
    // guide that only mentions them ("rupee": the external account's rupee, not CPI's labourer's rupee)
    const about = (gi) => words.every((w) => gTok[gi].some((t) => tokenMatches(w, t)));
    const p = rank(plates.map((x, i) => { const tt = tokens(x[2]), s0 = score(tt, [...tt, ...tokens(x[3]), ...gTok[x[0]]]); return { i, s: s0 && s0 + (about(x[0]) ? 1 : 0),
      strong: words.every((w) => tt.some((t) => tokenMatches(w, t))), href: `/guides/${guides[x[0]][0]}/#${x[1]}`, title: x[2], note: guides[x[0]][1] }; }));
    const files = rank(views.map((v, i) => ({ i, s: score(tokens(v[1]), [...tokens(v[1]), ...gTok[v[0]]]), href: v[2], title: v[1],
      note: `${guides[v[0]][1]}, every cut, ${v[3].toLocaleString("en-IN")} series` })));
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

  // ----- series: token shards (row and bundle postings), then the row chunks of the best rows
  async function postingsFor(word) {
    const want = new Set();
    for (const f of word.forms) {
      const isPrefix = word.prefix && f === word.w;
      const a = floorIdx(shards.tokens, f), b = isPrefix ? floorIdx(shards.tokens, f + "￿") : a;
      for (let i = a; i <= b; i++) want.add(i);
    }
    const ids = [], bids = [];
    const loaded = await Promise.all([...want].map(shard));
    for (const s of loaded) for (const [k, d] of Object.entries(s)) {
      if (k[0] === "~") { if (tokenMatches(word, k.slice(1))) for (const id of decodeIds(d)) bids.push(id); }
      else if (tokenMatches(word, k)) for (const id of decodeIds(d)) ids.push(id);
    }
    const loose = [...frequent].some((t) => tokenMatches(word, t));
    return { ids: [...new Set(ids)].sort((x, y) => x - y), bids: new Set(bids), loose };
  }
  const rowsOfBundles = (bs) => bs.flatMap((bi) => Array.from({ length: counts[bi] }, (_, k) => starts[bi] + k));

  /** Every row matching the query, before the frequent-word check: { words, ids (ranked), score, deferred } */
  async function candidates(q, { signal } = {}) {
    check(signal);
    const words = parseQuery(q);
    if (!words.length) return null;
    // a state named in another spelling ("Orissa", "Pondicherry") finds the rows that use its name
    const named0 = stateIn(words);
    if (named0) { const canon = tokens(core.profiles[named0.i][1]).filter((t) => !STOP.has(t)); for (const w of named0.nameWords) w.forms = [...new Set([...w.forms, ...canon])]; }
    const intent=unitIntent(words,q);
    const [per, ranges] = await Promise.all([
      Promise.all(words.map(async w => { const { ids, bids, loose } = await postingsFor(w); return { w, ids: new Set(ids), list: ids, loose, ctx: bids }; })),
      unitGroup(intent),
    ]);
    check(signal);
    // seed: the word with the fewest rows of its own; a word that only frequent tokens or bundle
    // context satisfy cannot seed (it would list whole files), unless every word is like that
    const size = (p) => p.list.length + [...p.ctx].reduce((a, i) => a + counts[i], 0);
    const seeds = per.filter((p) => p.list.length).sort((a, b) => size(a) - size(b));
    // the bundles every word names somewhere (title, cut, source or guide): the files a query finds
    const fileHits = per.reduce((acc, p) => (acc === null ? new Set(p.ctx) : new Set([...acc].filter((bi) => p.ctx.has(bi)))), null) ?? new Set();
    if (!seeds.length) return { words, ids: [], score: new Map(), deferred: new Set(), tooBroad: per.some((p) => p.loose), fileHits, named: named0 };
    const seed = seeds[0];
    const pool = [...new Set([...seed.list, ...rowsOfBundles([...seed.ctx])])];
    const score = new Map();
    const deferred = [];
    const keep = [];
    const named = ownW.size ? named0 : null;
    let scanned = 0;
    for (const r of pool) {
      if (signal && ++scanned % 16384 === 0) { await new Promise(resolve => setTimeout(resolve, 0)); check(signal); }
      const bi = bundleOf(r);
      // the boost needs the topic words in the row's label or in what its bundle is about
      const own = named && ownW.has(r) && named.rest.every((w) => per.find((p) => p.w === w)?.ids.has(r) || [...(bTopic.get(bi) ?? [])].some((t) => tokenMatches(w, t)));
      let s = own ? ownW.get(r) : 0, ok = true, wait = false;
      for (const p of per) {
        if (p.ids.has(r)) s += 2;
        else if (p.ctx.has(bi)) s += 1;
        else if (p.loose) { s += 2; wait = true; }
        else { ok = false; break; }
      }
      if (!ok) continue;
      if(ranges&&inRanges(ranges,r))s+=4;
      score.set(r, s); keep.push(r);
      if (wait) deferred.push(r);
    }
    keep.sort((a, b) => score.get(b) - score.get(a) || a - b);
    return { words, ids: keep, score, deferred: new Set(deferred), looseWords: per.filter((p) => p.loose && !p.list.length).map((p) => p.w), named: named0, fileHits };
  }
  /** The rows (and their bundles' records) for these ids. */
  async function rowsAt(ids) {
    const out = new Map();
    const byChunk = new Map();
    for (const r of ids) { const c = Math.floor(r / shards.rpc); if (!byChunk.has(c)) byChunk.set(c, []); byChunk.get(c).push(r); }
    await Promise.all([
      ...[...byChunk].map(async ([c, rs]) => { const data = await chunk(c); for (const r of rs) out.set(r, data[r - c * shards.rpc]); }),
      bundlesAt(ids.map(bundleOf)),
    ]);
    return out;
  }
  // a deferred row passes when its own label or group carries each frequent word it relied on
  const passes = (row, words) => { const t = indexTokens(row[0] + " " + row[1]); return words.every((w) => t.some((x) => tokenMatches(w, x))); };
  const onGuidePage = (id) => { const b = rec(bundleOf(id)), off = id - b[4]; let url = null; for (const [o, u] of b[6]) if (o <= off) url = u; return !!url && !url.includes("/every-cut/"); };

  /** Whole files every word names, best title first, with the every-cut views the core knows. */
  async function filesFor(c, q, limit = 6) {
    const words = c.words;
    const bis = [...c.fileHits].sort((a, b) => a - b).slice(0, 48);
    await bundlesAt(bis);
    const out = bis.map((bi) => {
      const b = rec(bi), title = tokens(b[1]);
      let s = 0; for (const w of words) s += title.some((t) => tokenMatches(w, t)) ? 2 : 1;
      const quality = qualityOf(bi);
      return { i: bi, s, href: quality?.canInterpret===false&&b[8]?`/explore/?${new URLSearchParams({series:b[0]+':'+b[8]})}`:(b[6][0]?.[1] ?? `/data/${b[0]}.csv`),
        title: quality?.canInterpret===false?(quality.publicTitle??'Source file under review'):b[1],
        note: [quality?.canInterpret===false?'Source mapping under review':null,b[3] >= 0 ? guides[b[3]][1] : null, b[2], `${b[5].toLocaleString("en-IN")} series`].filter(Boolean).join(", "), slug: b[0], quality };
    });
    return [...out, ...quick(q, { limit }).files.map((f) => ({ ...f, i: counts.length + f.i }))].sort((a, b) => b.s - a.s || a.i - b.i).slice(0, limit);
  }

  /** The best `limit` series, fetching at most `maxChunks` row chunks, and the files the query names. */
  async function series(q, { limit = 8, maxChunks = 6, signal, onCandidates } = {}) {
    const c = await candidates(q, { signal });
    check(signal);
    if (!c) return { rows: [], total: 0, tooBroad: false, files: [] };
    const filesP = filesFor(c, q);
    if (!c.ids.length) { const files = await filesP; check(signal); return { rows: [], total: 0, tooBroad: c.tooBroad ?? false, files }; }
    if(onCandidates) {
      const seen=new Set(), hits=[];
      for(const id of c.ids.slice(0,128)) {
        const bi=bundleOf(id);
        if(qualityOf(bi,id)?.canInterpret===false)continue;
        const g=bGuide[bi];
        if(g<0||seen.has(g))continue;
        seen.add(g);hits.push({href:`/guides/${guides[g][0]}/`,title:guides[g][1],note:guides[g][2]});
        if(hits.length===3)break;
      }
      onCandidates({guides:hits,total:c.ids.length});
    }
    const looseWords = c.words.filter((w) => c.looseWords.includes(w.w));
    const picked = [], chunksUsed = new Set();
    for (const r of c.ids) {
      const ch = Math.floor(r / shards.rpc);
      if (!chunksUsed.has(ch) && chunksUsed.size >= maxChunks) continue;
      chunksUsed.add(ch);
      picked.push(r);
      if (picked.length >= limit * 8) break;
    }
    const [data, files] = await Promise.all([rowsAt(picked), filesP]);
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
      // A query that names no place wants the whole country first: a row for India, All India or
      // a total outranks the same row for one state, one fuel or one group (a tie-break, worth
      // less than one more word of the query in the label).
      // (When a place is named, the state's own measures decide: core.own above.)
      const national = c.named ? 0 : (NATIONAL.test(row[0] + " | " + row[1]) ? 0.5 : 0) + (TOTAL.test(row[0] + " | " + row[1]) ? 0.5 : 0);
      // A row its guide shows on the guide page itself (not only in an every-cut view) is one the
      // guide is about; the same match on a long-tail table cell ranks after it.
      const featured = onGuidePage(r) ? PROMINENCE : 0;
      // Long truthful qualifiers must not lose to a short label for another quantity.
      out.push({ id: r, row, exact: inLabel === words.length && extra <= 1, rank: c.score.get(r) + inLabel + national + featured - Math.min(extra / 4,1) - Math.min(row[0].length / 300,.25) });
    }
    out.sort((a, b) => b.rank - a.rank || a.id - b.id);
    return { rows: out.slice(0, limit).map(({ id, row, exact }) => ({ ...describe(id, row), exact })), total: c.ids.length, approx: c.deferred.size > 0, files };
  }
  /** Where a row lives: its guide, its every-cut page and the anchor of its row there.
   *  Its bundle's record must be loaded (rowsAt loads it). */
  function describe(id, row) {
    const bi = bundleOf(id), b = rec(bi);
    const off = id - b[4];
    let url = null;
    for (const [o, u] of b[6]) if (o <= off) url = u;
    const identity = `${b[0]}:${row[4]}`;
    const guideHref = url ? `${url}#${row[4]}` : `/data/${b[0]}.csv`;
    const quality=qualityOf(bi,id),blocked=quality?.canInterpret===false,expected=expectedScheduleContext(quality);
    return { identityVersion: 1, identity, explorerHref: `/explore/?${new URLSearchParams({series:identity})}`, guideHref,
      label: blocked?(row[6]??quality.publicTitle??'Source record under review'):row[0], originalLabel:row[0],quality,
      group: row[1], latest: blocked?null:row[2], period: row[3], recent: blocked||expected?[]:(row[5] ?? []),...(expected?{expectedSchedule:expected}:{}), bundle: b[0], file: b[1],
      guide: b[3] >= 0 ? guides[b[3]][1] : null, href: guideHref };
  }

  // A conservative spelling suggestion: one edit (including adjacent transposition), only when the
  // vocabulary offers exactly one correction. Never replace valid cuts/units. The vocabulary is
  // fetched only for a query that found nothing.
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
  async function suggest(q) {
    const lexicon = await cached(lexFile, 0, file("x/lex"), 1);
    const known = new Set(lexicon);
    const hasForm = (f, prefix) => { if (!prefix) return known.has(f); let i = floorIdx(lexicon, f); if (lexicon[i] < f) i++; return lexicon[i]?.startsWith(f) ?? false; };
    let result=q;
    for(const word of parseQuery(q)){
      if(word.w.length<5||word.forms.some(f=>hasForm(f,word.prefix&&f===word.w)))continue;
      const hits=lexicon.filter(t=>/^[a-z]+$/.test(t)&&oneEdit(word.w,t));
      if(hits.length===1)result=result.replace(new RegExp(`\\b${word.w}\\b`,'i'),hits[0]);
    }
    return result===q?null:result;
  }
  return { quick, series, candidates, rowsAt, describe, passes, bundleOf, stateIn, suggest, guideOf: (bi) => bGuide[bi], bundleCount: () => counts.length, bundleStart: (bi) => starts[bi], bundleRows: (bi) => counts[bi] };
}
