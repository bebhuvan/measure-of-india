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

// profiles (lb/profiles): a state's name, in any spelling the state key knows, leads with its profile
test("a state's name finds its profile first, in every spelling", async () => {
  const { STATES } = await import("../src/dossiers/states-key.js");
  const profiles = STATES.map((u) => [u.slug, u.name, [...new Set([u.short, ...u.aliases].filter(Boolean))].join(" | ")]);
  const core = { guides: [["states", "State economies", "income per person by state"]], plates: [], views: [], bundles: [], profiles, shards: { tokens: [""], rows: [0], frequent: [] } };
  const S = createSearch(core, async () => ({}));
  for (const [q, slug] of [["Orissa", "odisha"], ["Pondicherry", "puducherry"], ["NCT of Delhi", "delhi"], ["jammu & kashmir", "jammu-kashmir"], ["Tamil Nadu ", "tamil-nadu"], ["keral", "kerala"]]) {
    const r = S.quick(q).states;
    assert.ok(r.length && r[0].lead, `${q}: no profile leads`);
    assert.equal(r[0].href, `/states/${slug}/`, q);
  }
  const mixed = S.quick("inflation in kerala ").states;
  assert.equal(mixed[0]?.href, "/states/kerala/");
  // "inflation" is no topic of this one-guide index, so the profile is offered, not led with
  assert.equal(mixed[0].lead, false);
  assert.equal(S.quick("onion").states.length, 0);
});

// datafix (2026-10-10): "inflation in kerala" ranked CPI-AL and CPI-RL rows above Kerala's own CPI.
// When a query names a state and a topic, the state's own headline measure (a row its profile
// quotes; core.own from scripts/search-index.mjs) leads the series, ahead of narrower rows that
// match the same words, and the state's profile leads the page.
test("a state and a topic: the state's own headline measure and its profile lead", async () => {
  const { STATES } = await import("../src/dossiers/states-key.js");
  const profiles = STATES.map((u) => [u.slug, u.name, [...new Set([u.short, ...u.aliases].filter(Boolean))].join(" | ")]);
  const ST = ["Kerala", "Bihar", "Punjab", "Tamil Nadu", "Gujarat", "Odisha", "Maharashtra", "Assam", "West Bengal", "Rajasthan", "Uttar Pradesh"];
  const guides = [["cpi", "Consumer prices", "retail inflation"], ["jobs", "Jobs", "unemployment and work"], ["states", "State economies", "income per person by state"],
    ["consumption", "What households spend", "monthly spending per person"], ["credit", "Bank credit", "loans and deposits"], ["health", "Health", "infant deaths"]];
  // [slug, title, cut, guide, own weight (0: narrower rows), row label template]
  const SPEC = [
    // the read-through's case: CPI-AL rows are labelled with the state's name alone, and sit first
    ["cpialrl-states", "CPI for agricultural and rural labourers (farm labourers), inflation by state", "State", 0, 0, (s) => [s, ""]],
    ["cpi-2024-states-divisions", "Retail inflation by state and division, CPI", "State x division", 0, 0, (s) => [`${s}, clothing and footwear`, ""]],
    ["cpi-2024-states", "Retail inflation by state, CPI base 2024", "State", 0, 3, (s) => [s, ""]],
    ["plfs-cy25-states-ur-edu", "Unemployment rate by state and education, PLFS", "State x education", 1, 0, (s) => [`${s}, graduates, unemployment rate`, ""]],
    ["plfs-cy25-states-ur", "Unemployment rate by state, PLFS", "State", 1, 2, (s) => [`${s}, unemployment rate, age 15 and above`, ""]],
    ["states-hbs-t113", "Daily wages by state, farm labour", "State", 2, 0, (s) => [`${s}: daily wage, ploughing`, ""]],
    ["states-pcnsdp-current", "Income per person by state, per capita NSDP", "State", 2, 3, (s) => [s, ""]],
    ["hces-states-groups", "Monthly spending per person by state and social group", "State x group", 3, 0, (s) => [`${s}, rural, scheduled castes, spending`, ""]],
    ["hces-states", "Monthly spending per person by state, MPCE", "State", 3, 3, (s) => [`${s}, rural`, ""]],
    ["credit-states-occupation", "Bank credit by state and occupation, deposits beside", "State x occupation", 4, 0, (s) => [`${s}, farm loans, bank credit`, ""]],
    ["credit-states", "Bank deposits and credit by state", "State", 4, 2, (s) => [`${s} deposits`, ""]],
    ["states-hbs-t004-rural", "Infant deaths per 1,000 births by state, rural and urban", "State x sector", 5, 0, (s) => [`${s}, rural, infant deaths`, ""]],
    ["states-hbs-t004", "Infant deaths per 1,000 births by state", "State", 5, 2, (s) => [`${s}, infant deaths`, ""]],
  ];
  const rows = [], bundles = [], ownG = [], ownO = [];
  for (const [slug, title, cut, g, w, lab] of SPEC) {
    const start = rows.length;
    for (const s of ST) { const id = rows.length; const [l, grp] = lab(s); rows.push([l, grp, "1", "2026", `s${id}`, []]); if (w === 3) ownG.push(id); if (w === 2) ownO.push(id); }
    bundles.push([slug, title, cut, g, start, ST.length, [[0, `/guides/${guides[g][0]}/`]], ""]);
  }
  const post = {};
  rows.forEach((r, i) => { for (const t of new Set(tokens(r[0] + " " + r[1]))) if (!["a", "and", "the"].includes(t)) (post[t] ??= []).push(i); });
  const shard = Object.fromEntries(Object.entries(post).map(([t, ids]) => [t, encodeIds(ids)]));
  const core = { guides, plates: [], views: [], bundles, profiles, own: { glance: encodeIds(ownG), other: encodeIds(ownO) },
    shards: { tokens: [""], rows: [0], frequent: [] } };
  const S = createSearch(core, async (p) => (p.startsWith("t/") ? shard : rows));
  const TEN = [
    ["inflation in kerala ", "cpi-2024-states", "kerala"], ["prices bihar ", "cpi-2024-states", "bihar"], ["unemployment in punjab ", "plfs-cy25-states-ur", "punjab"],
    ["jobs tamil nadu ", "plfs-cy25-states-ur", "tamil-nadu"], ["income per person gujarat ", "states-pcnsdp-current", "gujarat"], ["spending in odisha ", "hces-states", "odisha"],
    ["bank deposits maharashtra ", "credit-states", "maharashtra"], ["infant deaths assam ", "states-hbs-t004", "assam"], ["inflation west bengal ", "cpi-2024-states", "west-bengal"],
    ["unemployment rate rajasthan ", "plfs-cy25-states-ur", "rajasthan"], ["Orissa inflation ", "cpi-2024-states", "odisha"],
  ];
  for (const [q, bundle, state] of TEN) {
    const r = await S.series(q);
    assert.ok(r.rows.length, `${q}: no series`);
    assert.equal(r.rows[0].bundle, bundle, `${q}: leads with ${r.rows[0].bundle} "${r.rows[0].label}", not the state's own ${bundle}`);
    const st = S.quick(q).states;
    assert.equal(st[0]?.href, `/states/${state}/`, `${q}: profile`);
    assert.equal(st[0].lead, true, `${q}: the profile should lead`);
  }
  // a state with a word the site has no topic for: the profile is offered, not led with
  assert.equal(S.quick("kerala zebra ").states[0]?.lead, false);
  // no state named: no boost, the narrower rows keep their place by the words alone
  assert.equal((await S.series("farm labourers inflation ")).rows[0].bundle, "cpialrl-states");
  // and the fixture does test the boost: without core.own, CPI-AL leads "inflation in kerala"
  const bare = createSearch({ ...core, own: undefined }, async (p) => (p.startsWith("t/") ? shard : rows));
  assert.equal((await bare.series("inflation in kerala ")).rows[0].bundle, "cpialrl-states");
});
