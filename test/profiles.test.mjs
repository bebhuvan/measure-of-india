// test/profiles.test.mjs: the state profiles (src/dossiers/profiles.js). Every unit builds;
// no profile reads across a boundary seam; ranks count only units with the same period; the
// comparison period is one most units have published.
import { test } from "node:test";
import assert from "node:assert/strict";
import { STATES, FORMER_BY_SLUG, SEAMS, placeAll } from "../src/dossiers/states-key.js";
import { profile, page, MEASURES, load, cells, commonDate, measureAll, FMT, rankPhrase, RANK_EDGE } from "../src/dossiers/profiles.js";

import {loadBundle} from "../src/dossiers/everycut.js";

test("profiles and Every Cut share canonical bundle objects",()=>{
 assert.strictEqual(load("states-spread"),loadBundle("states-spread"));
});

const all = STATES.map((u) => ({ u, p: profile(u.slug) }));
const figsOf = (p) => p.sections.flatMap((s) => s.figures);

test("every state and union territory has a profile, and every section shows data or says why not", () => {
  assert.equal(all.length, 36);
  for (const { u, p } of all) {
    assert.ok(figsOf(p).length >= 40, `${u.slug}: only ${figsOf(p).length} figures`);
    if (u.kind === "state") assert.ok(p.figs.pc, `${u.slug}: a state with no income figure`);
  }
  for (const slug of ["bihar", "lakshadweep", "dnh-dd", "ladakh"]) {
    const g = page(slug);
    for (const s of g.sections) assert.ok(s.figures.length || s.none, `${slug}/${s.id}: empty and silent`);
  }
});

test("no profile reads across a boundary seam", () => {
  for (const { u, p } of all) {
    for (const f of figsOf(p)) {
      for (const [b, k] of f.src.args) {
        if (!k || typeof k !== "string") continue;
        const s = load(b).series[k];
        const hits = placeAll(s?.state ?? s?.geo ?? s?.label ?? k).map((h) => h.slug);
        assert.ok(!hits.some((h) => FORMER_BY_SLUG.has(h)), `${u.slug}/${f.id}: reads the former unit's series ${b}/${k}`);
      }
    }
  }
  // Andhra Pradesh and Jammu and Kashmir: a figure for a period before the split stands only
  // where the source carries the successor for that period
  for (const seam of SEAMS.filter((x) => typeof x.old === "string")) {
    const [kept, succ] = seam.next;
    for (const m of MEASURES) {
      const c = cells(m), b = load(m.bundle), k = c.cur.get(kept), ks = c.cur.get(succ);
      if (!k) continue;
      for (const f of [profile(kept).figs[m.id]].filter(Boolean)) {
        const i = b.dates.indexOf(f.iso);
        if (f.iso < seam.date.slice(0, 4) + "-01-01") assert.ok(ks && b.series[ks].data[i] != null, `${kept}/${m.id}: a figure for ${f.period}, before ${seam.date}, without ${succ} beside it`);
      }
    }
  }
  // the income chart carries the former J&K state as its own ruler, never inside the UT's line
  const jk = page("jammu-kashmir").charts.income;
  assert.ok(jk.mine.data.every(([d]) => d >= "2019-04-01"), "J&K UT income line reaches before 2019-20");
  assert.ok(jk.former.length === 1 && jk.former[0].data.every(([d]) => d < "2019-04-01"));
});

test("ranks count only units with a figure for the same period, at a period most units report", () => {
  for (const { u, p } of all) {
    for (const f of figsOf(p)) {
      if (!f.rank) continue;
      const m = MEASURES.find((x) => x.id === f.id);
      const same = measureAll(m, f.iso);
      assert.equal(f.rank.n, same.length, `${u.slug}/${f.id}: rank out of ${f.rank.n}, but ${same.length} units have ${f.period}`);
      const higher = same.filter((x) => x.v > f.value).length;
      assert.equal(f.rank.r, higher + 1, `${u.slug}/${f.id}`);
      if (f.newer) assert.equal(f.iso, commonDate(m), `${u.slug}/${f.id}: ranked away from the comparison period`);
    }
  }
});

test("every figure renders through a known format, with its period", () => {
  for (const { u, p } of all) for (const f of figsOf(p)) {
    assert.ok(FMT[f.fmt], `${u.slug}/${f.id}: unknown format`);
    assert.match(f.period, /\d{4}/, `${u.slug}/${f.id}: period "${f.period}"`);
    if (f.india) assert.match(f.india.period, /\d{4}/);
  }
});

test("ranks say highest or lowest only at the ends of the table", () => {
  for (let n = 3; n <= 36; n++) for (let r = 1; r <= n; r++) {
    const t = rankPhrase({ r, n });
    const m = /(\d+)(st|nd|rd|th) (highest|lowest)/.exec(t);
    if (m) assert.ok(+m[1] <= RANK_EDGE, `${r} of ${n}: "${t}"`);
    if (r > RANK_EDGE && n - r + 1 > RANK_EDGE) assert.match(t, /^(near the middle, )?\d+(st|nd|rd|th) of \d+,? counted from the highest$/);
    if (/^near the middle/.test(t)) assert.ok(r > n / 3 && r <= (2 * n) / 3, `${r} of ${n}: "${t}" is not the middle third`);
  }
  assert.equal(rankPhrase({ r: 17, n: 36 }), "near the middle, 17th of 36 counted from the highest");
  assert.equal(rankPhrase({ r: 6, n: 31 }), "6th of 31, counted from the highest");
  assert.equal(rankPhrase({ r: 34, n: 36 }), "3rd lowest of 36");
});
