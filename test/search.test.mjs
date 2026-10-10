// site search engine (src/dossiers/search-core.js): id coding, query parsing, and a tiny index end to end
import test from "node:test";
import assert from "node:assert/strict";
import { encodeIds, decodeIds, parseQuery, tokens, createSearch } from "../src/dossiers/search-core.js";

test("row ids survive gap and run coding", () => {
  for (const ids of [[], [0], [0, 1, 2, 3], [5, 8, 9, 10, 11, 40, 41, 100], Array.from({ length: 500 }, (_, i) => i * 3 + (i % 7 === 0 ? 1 : 0))]) {
    const sorted = [...new Set(ids)].sort((a, b) => a - b);
    assert.deepEqual(decodeIds(encodeIds(sorted)), sorted);
  }
  assert.deepEqual(encodeIds([5, 8, 9, 10]), [6, 3, -2]);
});

test("query words: the last is a prefix while typing, finished words whole with a plural", () => {
  const w = parseQuery("gold imp");
  assert.equal(w[1].prefix, true);
  assert.equal(w[0].prefix, false);
  assert.ok(w[0].forms.includes("golds"));
  assert.deepEqual(parseQuery("the price of onions ").map((x) => x.w), ["price", "onions"]);
  assert.deepEqual(tokens("Per-capita NSDP, ₹ crore"), ["per", "capita", "nsdp", "crore"]);
});

test("a tiny index finds series by label and by their file's context", async () => {
  const rows = [["Onion", "Vegetables", "48.3%", "Aug 2026", "s0000001", []], ["Potato", "Vegetables", "2.1%", "Aug 2026", "s0000002", []], ["Gold", "", "$72 bn", "2025-26", "s0000003", []]];
  const post = {};
  rows.forEach((r, i) => { for (const t of new Set(tokens(r[0] + " " + r[1]))) (post[t] ??= []).push(i); });
  const shard = Object.fromEntries(Object.entries(post).map(([t, ids]) => [t, encodeIds(ids)]));
  const core = { guides: [["cpi", "Consumer prices", ""], ["trade", "What India buys and sells", ""]], plates: [], views: [],
    bundles: [["cpi-items", "Items of the basket", "Item", 0, 0, 2, [[0, "/guides/cpi/"]], ""], ["trade-imports", "Imports by commodity", "Commodity", 1, 2, 1, [[0, "/guides/trade/every-cut/x/"]], ""]],
    shards: { tokens: [""], rows: [0], frequent: [] } };
  const S = createSearch(core, async (p) => (p.startsWith("t/") ? shard : rows));
  const on = await S.series("onio");
  assert.equal(on.rows[0].label, "Onion");
  assert.equal(on.rows[0].href, "/guides/cpi/#s0000001");
  const gi = await S.series("gold imports");
  assert.equal(gi.rows.length, 1);
  assert.equal(gi.rows[0].href, "/guides/trade/every-cut/x/#s0000003");
  assert.equal((await S.series("onion gold ")).rows.length, 0);
});
