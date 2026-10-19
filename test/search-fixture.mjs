// test/search-fixture.mjs: a small search index in the real v2 format, packed by
// src/dossiers/search-pack.js the way scripts/search-index.mjs packs the site's, so search tests
// exercise the files the browser reads. Not a test file itself (the runner takes *.test.mjs).
//
//   searchFixture({ guides, plates, views, profiles, bundles, quality, units, own })
//     bundles  [{ slug, title, cut, guide, ctx, reviewAnchor, rows: [[label, group, latest, period, anchor, recent, publicLabel?]], segs }]
//              segs default to the guide page; rows take global ids in bundle order
//     quality  { version, default, policies, bundles: { slug: policyId }, rowOverrides: { policyId: [row ids] } }
//     units    { group: [row ids] }    own { glance: [row ids], other: [row ids] }
//   -> { core, files, rows, load(path), fetch(url) }
import { indexTokens, STOP } from "../src/dossiers/search-core.js";
import { packSearchIndex } from "../src/dossiers/search-pack.js";

export function searchFixture({ guides, plates = [], thumbs, views = [], profiles = [], bundles, quality, units = {}, own }) {
  const rows = [], post = new Map(), bpost = new Map(), packed = [];
  const add = (m, t, id) => { if (STOP.has(t)) return; if (!m.has(t)) m.set(t, []); if (m.get(t).at(-1) !== id) m.get(t).push(id); };
  bundles.forEach((b, bi) => {
    for (const r of b.rows) { const id = rows.length; rows.push(r); for (const t of new Set(indexTokens(r[0] + " " + (r[1] || "")))) add(post, t, id); }
    const g = b.guide ?? 0;
    for (const t of new Set([...indexTokens([b.title, b.cut, b.ctx].filter(Boolean).join(" ")), ...(g >= 0 && guides[g] ? indexTokens(guides[g][1]) : [])])) add(bpost, t, bi);
    packed.push({ slug: b.slug, title: b.title, cut: b.cut ?? "", guide: g, count: b.rows.length, segs: b.segs ?? [[0, `/guides/${guides[g]?.[0] ?? "x"}/`]], ctx: b.ctx ?? "", reviewAnchor: b.reviewAnchor });
  });
  for (const ids of post.values()) ids.sort((a, b) => a - b);
  // the bundles that hold a state's own measures, and what they are about (search-index.mjs)
  const starts = []; { let acc = 0; for (const b of packed) { starts.push(acc); acc += b.count; } }
  const bundleOfRow = (r) => { let k = 0; while (k + 1 < starts.length && starts[k + 1] <= r) k++; return k; };
  const ownTopics = {};
  for (const id of [...(own?.glance ?? []), ...(own?.other ?? [])]) {
    const bi = bundleOfRow(id), b = packed[bi];
    ownTopics[bi] ??= [...new Set([...indexTokens(`${b.title} ${b.cut}`), ...(b.guide >= 0 && guides[b.guide] ? indexTokens(`${guides[b.guide][1]} ${guides[b.guide][2] ?? ""}`) : [])])];
  }
  const q = quality && { ...quality, bundles: Object.fromEntries(Object.entries(quality.bundles ?? {}).map(([slug, id]) => [packed.findIndex((b) => b.slug === slug), id])) };
  const { core, files } = packSearchIndex({ guides, plates, thumbs, views, profiles, bundles: packed, rows, post, bpost, units, own, ownTopics, quality: q });
  const load = async (p) => { if (!(p in files)) throw new Error(`fixture: no ${p}`); return files[p]; };
  const fetch = async (url) => ({ ok: true, json: async () => (url.endsWith("core.json") ? core : load(url.split("/search/")[1])) });
  return { core, files, rows, load, fetch };
}
