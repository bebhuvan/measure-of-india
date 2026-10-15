// src/dossiers/search-pack.js: packs the site search into the static files src/dossiers/search-core.js
// reads (index v2). Pure: takes the catalogue, returns { core, files } with each file's path and
// JSON value. scripts/search-index.mjs writes them under dist/search/ after a build; tests pack
// small catalogues the same way, so they exercise the real format.
//
// v2 keeps the core a fixed size as the catalogue grows. Everything per bundle or per row lives
// in files a query fetches only when it needs them:
//   core.json        guides, charts, every-cut views, state profiles, quality policies, and per
//                    bundle only its guide and row count; the first token of each token shard
//   t/<n>.json       token shards, in token order: { token: row ids, "~token": bundle ids } (the
//                    bundles whose title, cut, source or guide name the word)
//   r/<n>.json       row chunks, ROWS_PER_CHUNK rows each in global row order (no bounds to ship)
//   b/<n>.json       bundle records, BUNDLES_PER_FILE each: [slug, title, cut, guide, start,
//                    count, segs, ctx, reviewAnchor?]
//   u/<group>.json   rows of each quantity group (money, count, index...), for unit intent
//   lex.json         every indexed word, loaded only to suggest a spelling for a query that finds nothing
// Every name carries the release hash (core.rel), so an open tab can never mix releases, and
// every file is immutable.
import crypto from "node:crypto";
import { encodeIds } from "./search-core.js";

export const ROWS_PER_CHUNK = 512;
export const BUNDLES_PER_FILE = 64;
export const TOKEN_PACK = 32 * 1024;        // bytes of JSON per token shard, about
export const FREQUENT_BYTES = 900 * 1024;   // a coded posting list longer than this is dropped (search-core: "frequent")

export { encodeIds };

/**
 * @param {object} c
 *   guides   [[slug, title, blurb, formalName]]
 *   plates   [[guideIdx, figureId, title, finding]]
 *   views    [[guideIdx, label, href, rows]]
 *   profiles [[slug, name, aliases]]
 *   bundles  [{ slug, title, cut, guide, segs, ctx, reviewAnchor }] in row order; rows of bundle k
 *            follow those of bundle k-1
 *   rows     [[label, group, latestText, period, anchor, recent, publicLabel?]] in global order;
 *            each bundle's count is how many rows it owns (bundles[k].count)
 *   post     Map token -> sorted row ids          bpost  Map token -> sorted bundle ids
 *   units    { group: sorted row ids }            own    { glance: ids, other: ids }
 *   ownTopics { bundleIdx: [tokens] }             quality { version, default, policies, bundles: {bundleIdx: id}, rowOverrides: {id: ids} }
 */
export function packSearchIndex(c) {
  const files = new Map();     // logical name -> value, named with the release hash at the end
  // token shards: both postings of a word sit in the same shard
  const toks = [...new Set([...c.post.keys(), ...c.bpost.keys()])].sort();
  const frequent = [], tFirst = [];
  let cur = {}, curBytes = 2, nT = 0;
  const flushT = () => { if (Object.keys(cur).length) { files.set(`t/${nT++}`, cur); cur = {}; curBytes = 2; } };
  for (const t of toks) {
    const rows = c.post.get(t), bs = c.bpost.get(t);
    const entry = {};
    if (rows) { const d = encodeIds(rows); if (JSON.stringify(d).length > FREQUENT_BYTES) frequent.push(t); else entry[t] = d; }
    if (bs) entry["~" + t] = encodeIds(bs);
    const bytes = JSON.stringify(entry).length;
    if (!Object.keys(entry).length) continue;
    if (curBytes + bytes > TOKEN_PACK && Object.keys(cur).length) flushT();
    if (!Object.keys(cur).length) tFirst.push(t);
    Object.assign(cur, entry); curBytes += bytes;
  }
  flushT();
  if (tFirst.length) tFirst[0] = "";   // the first shard answers for any word before its first token
  // row chunks, fixed size
  for (let i = 0; i * ROWS_PER_CHUNK < c.rows.length; i++) files.set(`r/${i}`, c.rows.slice(i * ROWS_PER_CHUNK, (i + 1) * ROWS_PER_CHUNK));
  // bundle records
  let start = 0;
  const recs = c.bundles.map((b) => { const r = [b.slug, b.title, b.cut, b.guide, start, b.count, b.segs, b.ctx, ...(b.reviewAnchor ? [b.reviewAnchor] : [])]; start += b.count; return r; });
  if (start !== c.rows.length) throw new Error(`search-pack: bundles own ${start} rows, ${c.rows.length} given`);
  for (let i = 0; i * BUNDLES_PER_FILE < recs.length; i++) files.set(`b/${i}`, recs.slice(i * BUNDLES_PER_FILE, (i + 1) * BUNDLES_PER_FILE));
  const groups = Object.keys(c.units ?? {}).sort();
  for (const g of groups) files.set(`u/${g}`, encodeIds(c.units[g]));
  files.set("lex", [...c.post.keys()].sort());
  // one hash over every file names the release
  const h = crypto.createHash("sha256");
  for (const [k, v] of [...files].sort(([a], [b]) => (a < b ? -1 : 1))) h.update(k + "\0" + JSON.stringify(v) + "\0");
  const quality = c.quality && { ...c.quality, rowOverrides: Object.fromEntries(Object.entries(c.quality.rowOverrides ?? {}).map(([k, ids]) => [k, encodeIds(ids)])) };
  const core0 = { guides: c.guides, plates: c.plates, views: c.views, profiles: c.profiles ?? [], quality };
  h.update(JSON.stringify(core0));
  const rel = h.digest("hex").slice(0, 12);
  const out = {};
  for (const [k, v] of files) out[`${k}.${rel}.json`] = v;
  const core = {
    v: 2, identityVersion: 1, rel, nSeries: c.rows.length, ...core0,
    ...(quality ? {} : { quality: undefined }),
    own: { glance: encodeIds(c.own?.glance ?? []), other: encodeIds(c.own?.other ?? []) },
    ownTopics: c.ownTopics ?? {},
    bundles: { guide: c.bundles.map((b) => b.guide), count: c.bundles.map((b) => b.count) },
    shards: { tokens: tFirst, frequent: frequent.sort(), rpc: ROWS_PER_CHUNK, bpf: BUNDLES_PER_FILE, units: groups },
  };
  if (!quality) delete core.quality;
  return { core, files: out };
}
