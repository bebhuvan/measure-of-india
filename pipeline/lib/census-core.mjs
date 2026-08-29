// pipeline/lib/census-core.mjs — the deterministic per-series and
// cross-series fact extraction shared by scripts/census.mjs (the full
// inventory) and pipeline/facts.mjs (the writer's facts sheet). One
// definition, two consumers: a ranking computed for prose must be the same
// ranking the census audited. Pure functions over baked bundles — no I/O.

/* ---- period helpers (mirror pipeline/lib/periods.mjs semantics) ---- */

const periodOf = (iso) => iso.slice(0, 7);
const yearBefore = (iso) => {
  const [y, m, d] = iso.split("-").map(Number);
  return `${String(y - 1).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
};

// trailing run of non-null same-direction steps (the facts.mjs definition)
export function trailingRun(dates, data) {
  let i = data.length - 1;
  while (i > 0 && (data[i] == null || data[i - 1] == null)) i--;
  if (i < 1 || data[i] == null || data[i - 1] == null) return { length: 0, direction: null };
  const dir = data[i] > data[i - 1] ? "up" : data[i] < data[i - 1] ? "down" : "flat";
  if (dir === "flat") return { length: 0, direction: null };
  let length = 1;
  let j = i;
  while (j > 0) {
    const a = data[j], b = data[j - 1];
    if (a == null || b == null) break;
    const d = a > b ? "up" : a < b ? "down" : "flat";
    if (d !== dir) break;
    length++;
    j--;
  }
  return { length, direction: dir, since: dates[j + 1] };
}

/* ---- per-series facts ---- */

export function seriesFacts(dates, s) {
  const data = s.data;
  const nonNull = data.filter((v) => v != null);
  let first = -1, last = -1;
  data.forEach((v, i) => { if (v != null) { if (first === -1) first = i; last = i; } });
  const lastVal = last >= 0 ? data[last] : null;
  const prevVal = last > 0 ? data[last - 1] : null;
  const lastDate = last >= 0 ? dates[last] : null;
  // year-ago comparison only when the axis has that exact date (monthly and
  // annual FY axes are 12 months apart by cadence; quarterly is not)
  const yIdx = lastDate ? dates.indexOf(yearBefore(dates[last])) : -1;
  const yearAgo = yIdx >= 0 ? data[yIdx] : null;
  let min = Infinity, max = -Infinity, minAt = null, maxAt = null;
  data.forEach((v, i) => {
    if (v == null) return;
    if (v < min) { min = v; minAt = dates[i]; }
    if (v > max) { max = v; maxAt = dates[i]; }
  });
  const interiorGaps = [];
  if (first >= 0) {
    data.forEach((v, i) => { if (v == null && i > first && i < last) interiorGaps.push(dates[i]); });
  }
  return {
    key: s.key,
    label: s.label ?? s.key,
    unit: s.unit ?? null,
    points: data.length,
    nonNull: nonNull.length,
    nullShare: data.length ? +(1 - nonNull.length / data.length).toFixed(4) : 1,
    span: first >= 0 ? [dates[first], dates[last]] : null,
    latest: lastVal,
    latestPeriod: lastDate ? periodOf(lastDate) : null,
    previous: prevVal,
    yearAgo,
    deltaVsPrev: lastVal != null && prevVal != null ? +(lastVal - prevVal).toFixed(4) : null,
    deltaVsYearAgo: lastVal != null && yearAgo != null ? +(lastVal - yearAgo).toFixed(4) : null,
    min: min === Infinity ? null : min,
    minAt: minAt ? periodOf(minAt) : null,
    max: max === -Infinity ? null : max,
    maxAt: maxAt ? periodOf(maxAt) : null,
    run: trailingRun(dates, data),
    interiorGaps,
  };
}

/* ---- headline resolution ---- */

// The conventional keys a bundle's headline carries, in priority order. The
// census's richer resolver (multi-bundle candidates, CLI override) lives in
// scripts/census.mjs; the facts sheet only ever looks inside one bundle.
export const commonHeadline = (keys) =>
  ["headline", "general", "gdp", "gva", "mpce_total", "ur", "wpr"].find((k) => keys.includes(k)) ?? null;

/* ---- cross-bundle facts ---- */

// Rankable metrics: latest value and latest-vs-year-ago delta. Series on
// different bases/units are ranked within their own bundle — cross-bundle
// rankings only among series with the same unit inside the same bundle.
// `hDir` is the headline's own direction of travel (sign of its
// delta-vs-year-ago): contradictions are judged against the headline's move
// in EVERY bundle, not just the bundle that carries the headline.
// `headlineKey` is the headline series' key NAME — excluded from
// contradictions wherever a same-named series appears (a sibling bundle's
// "general" is not a contradiction of the headline). Head facts (counts
// above/below, with/against) attach only to the bundle that carries the
// headline: pass `isHeadlineBundle`.
export function crossBundle(bundleSlug, seriesFactsList, headlineKey = null, hDir = null, isHeadlineBundle = false) {
  const byLatest = [...seriesFactsList].sort((a, b) => (b.latest ?? -Infinity) - (a.latest ?? -Infinity));
  const byDelta = seriesFactsList.filter((s) => s.deltaVsYearAgo != null).sort((a, b) => b.deltaVsYearAgo - a.deltaVsYearAgo);
  const ranked = byDelta.length ? byDelta : byLatest;
  const head = isHeadlineBundle ? seriesFactsList.find((s) => s.key === headlineKey) : null;
  const ownHDir = head && head.deltaVsYearAgo != null ? Math.sign(head.deltaVsYearAgo) : null;
  const cDir = hDir ?? ownHDir;
  const entry = {
    bundle: bundleSlug,
    topByDelta: byDelta[0] ?? null,
    bottomByDelta: byDelta[byDelta.length - 1] ?? null,
    spreadDelta: byDelta.length > 1 ? +(byDelta[0].deltaVsYearAgo - byDelta[byDelta.length - 1].deltaVsYearAgo).toFixed(4) : null,
    // contradiction: a series moving against the headline's own latest move
    contradictions: cDir == null ? [] : seriesFactsList.filter((s) => s.key !== headlineKey && s.deltaVsYearAgo != null && Math.sign(s.deltaVsYearAgo) !== cDir).map((s) => s.key),
    ranking: ranked.map((s) => s.key),
  };
  if (head) {
    const sameDir = (s) => s.deltaVsYearAgo != null && Math.sign(s.deltaVsYearAgo) === ownHDir;
    entry.countAboveHeadline = seriesFactsList.filter((s) => s.key !== headlineKey && s.latest != null && head.latest != null && s.latest > head.latest).length;
    entry.countBelowHeadline = seriesFactsList.filter((s) => s.key !== headlineKey && s.latest != null && head.latest != null && s.latest < head.latest).length;
    entry.countMovingWithHeadline = ownHDir == null ? null : seriesFactsList.filter((s) => s.key !== headlineKey && sameDir(s)).length;
    entry.countMovingAgainstHeadline = ownHDir == null ? null : seriesFactsList.filter((s) => s.key !== headlineKey && s.deltaVsYearAgo != null && Math.sign(s.deltaVsYearAgo) !== ownHDir).length;
  }
  return entry;
}

