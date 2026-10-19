// site search engine (src/dossiers/search-core.js): id coding, query parsing, and a tiny index end to end
import test from "node:test";
import assert from "node:assert/strict";
import { encodeIds, decodeIds, parseQuery, tokens, createSearch } from "../src/dossiers/search-core.js";
import { searchFixture } from "./search-fixture.mjs";

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
  const { core, load } = searchFixture({ guides: [["cpi", "Consumer prices", ""], ["trade", "What India buys and sells", ""]], bundles: [
    { slug: "cpi-items", title: "Items of the basket", cut: "Item", guide: 0, segs: [[0, "/guides/cpi/"]], rows: [["Onion", "Vegetables", "48.3%", "Aug 2026", "s0000001", []], ["Potato", "Vegetables", "2.1%", "Aug 2026", "s0000002", []]] },
    { slug: "trade-imports", title: "Imports by commodity", cut: "Commodity", guide: 1, segs: [[0, "/guides/trade/every-cut/x/"]], rows: [["Gold", "", "$72 bn", "2025-26", "s0000003", []]] }] });
  const S = createSearch(core, load);
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
  const { core, load } = searchFixture({ guides: [["states", "State economies", "income per person by state"]], profiles, bundles: [] });
  const S = createSearch(core, load);
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
  const bundles = [], ownG = [], ownO = [];
  let n = 0;
  for (const [slug, title, cut, g, w, lab] of SPEC) {
    const rows = [];
    for (const st of ST) { const id = n++; const [l, grp] = lab(st); rows.push([l, grp, "1", "2026", `s${id}`, []]); if (w === 3) ownG.push(id); if (w === 2) ownO.push(id); }
    bundles.push({ slug, title, cut, guide: g, rows });
  }
  const { core, load } = searchFixture({ guides, profiles, bundles, own: { glance: ownG, other: ownO } });
  const S = createSearch(core, load);
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
  const plain = searchFixture({ guides, profiles, bundles });
  const bare = createSearch(plain.core, plain.load);
  assert.equal((await bare.series("inflation in kerala ")).rows[0].bundle, "cpialrl-states");
});

// datafix: "prices" in "at current prices" is a valuation basis, dropped from the index and from a
// query alike, so a row is still found by its own label and "prices in bihar" still means inflation
test("a valuation basis is no topic, in the index and in the query", () => {
  assert.deepEqual(parseQuery("Exports of goods, current prices ").map((w) => w.w), ["exports", "goods", "current"]);
  assert.ok(parseQuery("prices in bihar ")[0].forms.includes("inflation"));
});

// reader feedback (2026-10-18): guides and charts were below the fold of a list the series filled
test("the reader's list: guides and charts before the series; broad words group charts by guide", async () => {
  const { layout, byGuide, broadQuery } = await import("../src/dossiers/search-core.js");
  const guides = [["cpi", "Consumer prices", ""], ["schools", "Schools", ""], ["households", "Household amenities", ""]];
  const plates = [[0, "cb-rural", "Rural prices rose faster", "Rural inflation was 3.2%"], [1, "cb-water", "Rural schools with water", "Most rural schools have taps", 1],
    [2, "cb-san", "Rural sanitation", "Toilets in rural homes", 1], [2, "cb-tap", "Tap water at home", "Rural homes with a tap"]];
  const thumbs = new Map([["schools/cb-water", "<svg/>"], ["households/cb-san", "<svg/>"]]);
  const { core, files, load } = searchFixture({ guides, plates, thumbs, bundles: [
    { slug: "cpi-r", title: "Rural index", cut: "State", guide: 0, rows: [["Goa, rural", "", "4.1%", "Aug 2026", "s0000001", []], ["Egg, rural", "", "2%", "Aug 2026", "s0000002", []]] }] });
  const S = createSearch(core, load);
  const quick = S.quick("rural", { plateLimit: 60 });
  assert.equal(quick.n.plates, 4);
  assert.equal(quick.plates.find((p) => p.title === "Rural sanitation").thumb, `th/households/cb-san.${core.rel}.svg`);
  assert.ok(`th/households/cb-san.${core.rel}.svg` in files, "the thumbnail is a file of the release");
  assert.equal(quick.plates.find((p) => p.title === "Tap water at home").thumb, null);
  const series = await S.series("rural");
  const kinds = layout(quick, series).filter((s) => s.items.length).map((s) => s.kind);
  assert.ok(kinds.indexOf("top") < kinds.indexOf("series"), `charts after series: ${kinds}`);
  // the list does not reorder when the series arrive: everything before them is the same
  const before = layout(quick, null).flatMap((s) => s.kind === "series" ? [] : s.items.map((x) => x.href));
  const after = layout(quick, series).flatMap((s) => s.kind === "series" || s.kind === "files" ? [] : s.items.map((x) => x.href));
  assert.deepEqual(after, before.filter((h) => after.includes(h)));
  assert.ok(broadQuery("rural", quick.plates));
  assert.ok(!broadQuery("rural water", quick.plates));
  const groups = byGuide(quick.plates);
  assert.equal(groups.length, 3);
  assert.equal(groups.find((g) => g.title === "Household amenities").items.length, 2);
  assert.ok(series.nFiles >= 1);
});
