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

/** A search over the files above. `load(path)` returns the parsed JSON of /search/<path>. */
export function createSearch(core, load) {
  const { guides, plates, bundles, views, shards } = core;
  const frequent = new Set(shards.frequent);
  const tShards = new Map(), rChunks = new Map();
  const shard = (i) => { if (!tShards.has(i)) tShards.set(i, load(`t/${i}.json`)); return tShards.get(i); };
  const chunk = (i) => { if (!rChunks.has(i)) rChunks.set(i, load(`r/${i}.json`)); return rChunks.get(i); };
  const starts = bundles.map((b) => b[4]);
  const bundleOf = (row) => floorIdx(starts, row);
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
      ...bundles.map((b, i) => ({ i, s: score(tokens(b[1]), bTok[i]), href: b[6][0]?.[1] ?? `/data/${b[0]}.csv`, title: b[1],
        note: [b[3] >= 0 ? guides[b[3]][1] : null, b[2], `${b[5].toLocaleString("en-IN")} series`].filter(Boolean).join(", "), slug: b[0] })),
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
      const a = floorIdx(shards.tokens, f), b = isPrefix ? floorIdx(shards.tokens, f + "￿") : a;
      for (let i = a; i <= b; i++) want.add(i);
    }
    const ids = [];
    for (const i of want) {
      const s = await shard(i);
      for (const [t, d] of Object.entries(s)) if (tokenMatches(word, t)) for (const id of decodeIds(d)) ids.push(id);
    }
    for (const t of frequent) if (tokenMatches(word, t)) loose = true;
    return { ids: [...new Set(ids)].sort((x, y) => x - y), loose };
  }
  const rowsOfBundles = (bs) => bs.flatMap((bi) => Array.from({ length: bundles[bi][5] }, (_, k) => bundles[bi][4] + k));

  /** Every row matching the query, before the frequent-word check: { words, ids (ranked), score, deferred } */
  async function candidates(q) {
    const words = parseQuery(q);
    if (!words.length) return null;
    // a state named in another spelling ("Orissa", "Pondicherry") finds the rows that use its name
    const named0 = stateIn(words);
    if (named0) { const canon = tokens(core.profiles[named0.i][1]).filter((t) => !STOP.has(t)); for (const w of named0.nameWords) w.forms = [...new Set([...w.forms, ...canon])]; }
    const per = [];
    for (const w of words) {
      const { ids, loose } = await postingsFor(w);
      const ctx = new Set(bundles.map((_, i) => i).filter((i) => bTok[i].some((t) => tokenMatches(w, t))));
      per.push({ w, ids: new Set(ids), list: ids, loose, ctx });
    }
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
    for (const r of pool) {
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
    for (const [c, rs] of byChunk) { const data = await chunk(c); for (const r of rs) out.set(r, data[r - shards.rows[c]]); }
    return out;
  }
  // a deferred row passes when its own label or group carries each frequent word it relied on
  const passes = (row, words) => { const t = indexTokens(row[0] + " " + row[1]); return words.every((w) => t.some((x) => tokenMatches(w, x))); };

  /** The best `limit` series, fetching at most `maxChunks` row chunks. */
  async function series(q, { limit = 8, maxChunks = 6 } = {}) {
    const c = await candidates(q);
    if (!c || !c.ids.length) return { rows: [], total: 0, tooBroad: c?.tooBroad ?? false };
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
    const words = c.words;
    const out = [];
    for (const r of picked) {
      const row = data.get(r);
      if (c.deferred.has(r) && !passes(row, looseWords)) continue;
      const lt = indexTokens(row[0]);
      const inLabel = words.filter((w) => lt.some((t) => tokenMatches(w, t))).length;
      // a label made of the query's words and little else ranks first ("repo rate": "Policy repo rate")
      const extra = lt.filter((t) => !STOP.has(t) && !words.some((w) => tokenMatches(w, t))).length;
      out.push({ id: r, row, rank: c.score.get(r) + inLabel - extra / 4 - row[0].length / 300 });
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
    return { label: row[0], group: row[1], latest: row[2], period: row[3], recent: row[5] ?? [], bundle: b[0], file: b[1],
      guide: b[3] >= 0 ? guides[b[3]][1] : null, href: url ? `${url}#${row[4]}` : `/data/${b[0]}.csv` };
  }
  return { quick, series, candidates, rowsAt, describe, passes, bundleOf, stateIn };
}
