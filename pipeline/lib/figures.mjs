// pipeline/lib/figures.mjs: every figure in prose, traced to the facts sheet (AGENTS.md hard
// rule 3). verify.mjs used to check only percents and points; this module extracts EVERY
// numeric token, with the scale or unit word that follows it, and decides whether the facts
// sheet holds that number at that scale.
//
// Scaling is unit-aware, never "any power of ten": a facts number may be restated at another
// scale only through its own series' unit. 437,000 in a usd_million series traces as
// "$437 billion" (437,000 x 1e6 / 1e9) and as "$4,37,000 million", never as "$437 million".
// A number whose unit is unknown traces only as written (0, 1 or 2 decimals, or its exact
// stored value; absolute values allowed, since prose says "fell 1.85%" for -1.85).
//
// Not figures, masked before extraction: periods (fiscal years 2025-26, Q1 FY27, FY27, day
// numbers in dates "7 October 2026"; bare years are checked by verify's own year pass), base
// strings ("2024=100"), codes (HS 03, NIC 01-03, Table 2.11), digit ordinals ("18th"), and
// the denominator of a rate ("per 1,00,000" is a unit, not a figure).

/* ---------- units of the bundles: the dimension a number measures, and its multiplier ---------- */
const U = (dim, mult) => ({ dim, mult });
export const UNIT_SCALE = {
  inr: U("inr", 1), inr_amount: U("inr", 1), inr_per_year: U("inr", 1), inr_per_day: U("inr", 1), inr_day: U("inr", 1),
  inr_lakh: U("inr", 1e5), inr_crore: U("inr", 1e7), crore: U("inr", 1e7), inr_lakh_crore: U("inr", 1e12), inr_bn: U("inr", 1e9),
  usd: U("usd", 1), usd_2015: U("usd", 1), usd_constant_2015: U("usd", 1), ppp_usd: U("usd", 1),
  usd_million: U("usd", 1e6), usd_millions: U("usd", 1e6), usd_mn: U("usd", 1e6), usd_bn: U("usd", 1e9),
  usd_ppp_2021_million: U("usd", 1e6),
  eur_bn: U("eur", 1e9), jpy_bn: U("jpy", 1e9), sdr_million: U("sdr", 1e6),
  count: U("count", 1), cases: U("count", 1), hundreds: U("count", 100), thousand: U("count", 1e3),
  lakh_count: U("count", 1e5), count_x1e7: U("count", 1e7), million_persons: U("count", 1e6), billion: U("count", 1e9),
  tonnes: U("tonne", 1), thousand_tonne: U("tonne", 1e3), lakh_tonnes: U("tonne", 1e5), mt: U("tonne", 1e6),
  hectares: U("hectare", 1), thousand_hectares: U("hectare", 1e3), thousand_bales: U("bale", 1e3),
  kwh: U("kwh", 1), thousand_kwh: U("kwh", 1e3), crore_kwh: U("kwh", 1e7), twh: U("kwh", 1e9),
  mw: U("mw", 1),
};
// scale words, and the dimensions each may restate. The number words apply to every quantity;
// GW and TWh only to power and energy.
const NUMBER_WORDS = { thousand: 1e3, lakh: 1e5, million: 1e6, mn: 1e6, crore: 1e7, billion: 1e9, bn: 1e9, "lakh crore": 1e12, trillion: 1e12, tn: 1e12 };
const QUANTITY = new Set(["inr", "usd", "eur", "jpy", "sdr", "count", "tonne", "hectare", "bale", "kwh", "mw"]);
const SPECIAL = { gw: ["mw", 1e3], mw: ["mw", 1], twh: ["kwh", 1e9], gwh: ["kwh", 1e6], mwh: ["kwh", 1e3], kwh: ["kwh", 1] };
export function scaleOf(word, dim) {
  if (!word) return null;
  const w = word.toLowerCase().replace(/\s+/g, " ");
  if (NUMBER_WORDS[w] != null) return QUANTITY.has(dim) ? NUMBER_WORDS[w] : null;
  if (SPECIAL[w]) return SPECIAL[w][0] === dim ? SPECIAL[w][1] : null;
  return null;
}
export const isScaleWord = (w) => !!w && (NUMBER_WORDS[w.toLowerCase().replace(/\s+/g, " ")] != null || SPECIAL[w.toLowerCase()] != null);

/* ---------- the allowed set ---------- */
// a number as the voice may write it: 1 and 2 dp (both the float's own toFixed and the
// half-up rounding a person does: 13.85 -> 13.9), whole numbers for integers and for figures
// of 100 or more, 3 dp below 1 (Gini), the exact stored value; signs dropped
const halfUp = (x, d) => (Math.sign(x) * Math.round(Math.abs(x) * 10 ** d + 1e-9) / 10 ** d).toFixed(d);
const renders = (v, { wholeFrom = 100 } = {}) => {
  const out = new Set();
  for (const x of [v, Math.abs(v)]) {
    for (const d of [1, 2]) { out.add(x.toFixed(d)); out.add(halfUp(x, d)); }
    if (Number.isInteger(x) || Math.abs(x) >= wholeFrom) { out.add(x.toFixed(0)); out.add(halfUp(x, 0)); }
    if (Math.abs(x) < 1) out.add(x.toFixed(3));
    out.add(String(x));
  }
  return out;
};
// a scale a facts key declares in its own name ("peak_bn": 785.7 is already in billions)
export const KEY_SCALE = { bn: "billion", billion: "billion", mn: "million", million: "million", cr: "crore", crore: "crore", lakh: "lakh", lakh_crore: "lakh crore", tn: "trillion", trillion: "trillion", thousand: "thousand" };
const SYNONYM = { billion: ["billion", "bn"], million: ["million", "mn"], trillion: ["trillion", "tn"], crore: ["crore"], lakh: ["lakh"], "lakh crore": ["lakh crore"], thousand: ["thousand"] };
export function makeAllowed() {
  const plain = new Set(), scaled = new Set(), counts = new Set();
  const addScaled = (word, x) => {
    if (Math.abs(x) < 0.005 || Math.abs(x) >= 1e8) return;
    for (const r of renders(x, { wholeFrom: 10 })) scaled.add(`${word}|${r}`);
  };
  return {
    plain, scaled, counts,
    add(v, unit) {
      if (typeof v !== "number" || !Number.isFinite(v)) return;
      for (const r of renders(v)) plain.add(r);
      const u = UNIT_SCALE[unit];
      if (!u) return;
      // the value in its base unit (979.179 thousand -> 979179), and that value rounded to
      // the thousand, lakh, million or crore a sentence writes it at ("about 979,000")
      const base = v * u.mult;
      if (u.mult !== 1) for (const r of renders(base)) plain.add(r);
      for (const step of [1e3, 1e5, 1e6, 1e7]) if (Math.abs(base) >= step * 10) plain.add(String(Math.round(Math.abs(base) / step) * step));
      for (const w of [...Object.keys(NUMBER_WORDS), ...Object.keys(SPECIAL)]) {
        const m = scaleOf(w, u.dim);
        if (m != null) addScaled(w, base / m);
      }
    },
    /** a number whose key names its scale: only that scale (and its synonym) traces */
    addAtScale(v, word) {
      if (typeof v !== "number" || !Number.isFinite(v)) return;
      for (const r of renders(v)) plain.add(r);
      for (const w of SYNONYM[word] ?? [word]) addScaled(w, v);
    },
    /** a count of series or prints (358 items, 32 rising): traces only written as a count */
    addCount(v) { if (Number.isInteger(v) && v >= 0) counts.add(String(v)); },
  };
}

/* ---------- extraction ---------- */
const MONTH = "(?:January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)";
const MASKS = [
  /\b(?:19|20)\d{2}\s*[-–]\s*(?:19|20)?\d{2}\b/g,                         // fiscal and agricultural years
  /\bQ[1-4]\s*FY\s?\d{2,4}\b|\bFY\s?\d{2,4}\b|\bQ[1-4]\b/g,                // Q1 FY27, FY27
  new RegExp(String.raw`\b\d{1,2}(?=\s+${MONTH}\b)`, "g"),                 // the day of a date
  /\b(?:19|20)\d{2}(?:-\d{2})?\s*=\s*100\b/g,                              // base strings
  /\b(?:base(?: year)?|base-year)\s+(?:19|20)\d{2}(?:-\d{2,4})?\b/gi,
  /\b(?:HS|NIC|NCO|COICOP|SITC|Table|Statement|Section|Schedule|Plate|Chapter|Article|Rule|Form|No\.)\s*[\d][\d.\-–]*/g,   // codes
  /\b\d+(?:st|nd|rd|th)\b/g,                                               // digit ordinals
  /\bNFHS-\d\b|\bCMIP\d\b|\bSSP\d-\d\.\d\b|\bG\d{1,2}\b|\bPM\d+(?:\.\d)?\b|\bCO2\b/g,      // names with digits
];
const RATE_DENOM = /\bper\s+(1,00,000|100,000|1,000|1000|100000|10,000|100|lakh)\b/gi;
const UNIT_WORDS = String.raw`lakh crore|lakh|crore|thousand|million|billion|trillion|bn|mn|tn|per cent|percent|percentage points?|%|pt|points?|bps|basis points|°C|°|degrees|mm|times|x(?![a-z])|GW|MW|TWh|GWh|MWh|kWh|years?|months?|days?`;
const FIG = new RegExp(String.raw`(?<![\w.])([−-])?(\d{1,3}(?:,\d{2,3})+|\d+)(\.\d+)?(?:\s*(${UNIT_WORDS}))?`, "gi");
const blank = (s) => s.replace(/[^\n]/g, " ");

/** Figures in prose: [{ raw, str, scale, unit }]. str is the number as written, commas removed. */
export function extractFigures(prose) {
  let t = prose.replace(RATE_DENOM, (m) => "per " + blank(m.slice(4)));
  for (const re of MASKS) t = t.replace(re, blank);
  const out = [];
  for (const m of t.matchAll(FIG)) {
    const intPart = m[2], dec = m[3] ?? "", word = m[4] ?? "";
    const str = intPart.replace(/,/g, "") + dec;
    // a bare four-digit year is a period, checked by verify's year pass, not a figure
    if (!dec && !word && /^(19|20)\d{2}$/.test(str) && !intPart.includes(",")) continue;
    out.push({ raw: m[0].trim(), str, scale: isScaleWord(word) ? word.toLowerCase().replace(/\s+/g, " ") : null, unit: word || null });
  }
  return out;
}

/** Does the facts sheet hold this figure at this scale? */
const RATE_UNIT = /^(%|per ?cent|percentage points?|pt|points?|bps|basis points)$/i;
export function traces(fig, allowed) {
  if (fig.scale) return allowed.scaled.has(`${fig.scale}|${fig.str}`);
  if (allowed.plain.has(fig.str)) return true;
  // a structural count traces only as a count, never as a rate ("358 items", not "358%")
  return !(fig.unit && RATE_UNIT.test(fig.unit)) && allowed.counts.has(fig.str);
}
