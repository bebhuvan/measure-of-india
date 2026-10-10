// src/dossiers/states-key.js: THE state key. Every state and union territory, with the
// spellings each source uses, so every source's state labels map through one table.
// Pure data plus matchers, no imports: Astro pages, scripts and tests all read it.
//
// Codes:
//   iso   ISO 3166-2:IN subdivision code (the 2023 revision: IN-CG, IN-OD, IN-TS, IN-UK)
//   lgd   Local Government Directory state code (the Census 2011 state code for units
//         that existed in 2011; Telangana 36, Ladakh 37, the merged Dadra and Nagar Haveli
//         and Daman and Diu 38)
//   cckp  the World Bank Climate Change Knowledge Portal geocode (IND.<n>), read from
//         data/raw/climate-cckp.json.gz; CCKP draws no unit for Jammu and Kashmir or
//         Ladakh, and still draws the two former UTs that merged in 2020
//
// Boundary changes (each a seam: a profile shows the post-change unit, and a figure for the
// old unit is shown only under the old unit's name, never joined to the new series):
//   2014-06-02  Andhra Pradesh split into Andhra Pradesh and Telangana
//   2019-10-31  the state of Jammu and Kashmir became two union territories, J&K and Ladakh
//   2020-01-26  Dadra and Nagar Haveli, and Daman and Diu, merged into one union territory
//
// Matching: normalise() lower-cases, turns "&" into "and", drops dots and other punctuation,
// and collapses spaces; placeAll() finds every alias as a whole-word run, longest first, so
// "Dadra and Nagar Haveli and Daman and Diu" never reads as its two former halves.

export const SEAMS = [
  { id: "ap-2014", date: "2014-06-02", fy: "2014-15", old: "andhra-pradesh-undivided", next: ["andhra-pradesh", "telangana"],
    text: "Andhra Pradesh split into Andhra Pradesh and Telangana on 2 June 2014" },
  { id: "jk-2019", date: "2019-10-31", fy: "2019-20", old: "jammu-kashmir-state", next: ["jammu-kashmir", "ladakh"],
    text: "the state of Jammu and Kashmir became two union territories, Jammu and Kashmir and Ladakh, on 31 October 2019" },
  { id: "dnhdd-2020", date: "2020-01-26", fy: "2019-20", old: ["dadra-nagar-haveli", "daman-diu"], next: ["dnh-dd"],
    text: "Dadra and Nagar Haveli, and Daman and Diu, merged into one union territory on 26 January 2020" },
];

// kind: state | ut-legislature (a UT with an elected assembly) | ut
// region: the zone a reader would name; neighbours: units sharing a land border
export const STATES = [
  { slug: "andaman-nicobar", name: "Andaman and Nicobar Islands", short: "Andaman and Nicobar", kind: "ut", iso: "IN-AN", lgd: 35, cckp: "IND.1151", region: "Islands",
    aliases: ["andaman and nicobar islands", "andaman and nicobar island", "andaman and nicobar", "andaman nicobar islands", "andaman nicobar", "andaman and n islands", "a and n islands", "andaman"], neighbours: [] },
  { slug: "andhra-pradesh", name: "Andhra Pradesh", kind: "state", iso: "IN-AP", lgd: 28, cckp: "IND.1152", region: "South",
    aliases: ["andhra pradesh", "andhra pradesh after telangana was separated", "andhra pradesh residual"], neighbours: ["telangana", "karnataka", "tamil-nadu", "odisha", "chhattisgarh", "puducherry"], since: "2014-06-02", seam: "ap-2014" },
  { slug: "arunachal-pradesh", name: "Arunachal Pradesh", kind: "state", iso: "IN-AR", lgd: 12, cckp: "IND.1153", region: "North-east",
    aliases: ["arunachal pradesh"], neighbours: ["assam", "nagaland"] },
  { slug: "assam", name: "Assam", kind: "state", iso: "IN-AS", lgd: 18, cckp: "IND.1154", region: "North-east",
    aliases: ["assam"], neighbours: ["arunachal-pradesh", "nagaland", "manipur", "mizoram", "tripura", "meghalaya", "west-bengal"] },
  { slug: "bihar", name: "Bihar", kind: "state", iso: "IN-BR", lgd: 10, cckp: "IND.1155", region: "East",
    aliases: ["bihar"], neighbours: ["uttar-pradesh", "jharkhand", "west-bengal"] },
  { slug: "chandigarh", name: "Chandigarh", kind: "ut", iso: "IN-CH", lgd: 4, cckp: "IND.1156", region: "North",
    aliases: ["chandigarh"], neighbours: ["punjab", "haryana"] },
  { slug: "chhattisgarh", name: "Chhattisgarh", kind: "state", iso: "IN-CG", lgd: 22, cckp: "IND.1157", region: "Central",
    aliases: ["chhattisgarh", "chattisgarh", "chhatisgarh", "chhattishgarh"], neighbours: ["madhya-pradesh", "uttar-pradesh", "jharkhand", "odisha", "andhra-pradesh", "telangana", "maharashtra"] },
  { slug: "dnh-dd", name: "Dadra and Nagar Haveli and Daman and Diu", short: "DNH and Daman and Diu", kind: "ut", iso: "IN-DH", lgd: 38, cckp: null, region: "West",
    aliases: ["dadra and nagar haveli and daman and diu", "dadra nagar haveli and daman and diu", "dadra and nagar haveli and daman diu", "dadra nagar haveli and daman diu",
      "dadra and nagar havelli and daman and diu", "dadra nagar havelli and daman diu", "dadra and nagar haveli daman and diu", "dadra nagar haveli daman diu", "dadra nagar havelli daman diu", "dnh and dd", "dnhdd"],
    neighbours: ["gujarat", "maharashtra"], since: "2020-01-26", seam: "dnhdd-2020" },
  { slug: "delhi", name: "Delhi", kind: "ut-legislature", iso: "IN-DL", lgd: 7, cckp: "IND.11510", region: "North",
    aliases: ["nct of delhi", "nct delhi", "delhi"], neighbours: ["haryana", "uttar-pradesh"] },
  { slug: "goa", name: "Goa", kind: "state", iso: "IN-GA", lgd: 30, cckp: "IND.11511", region: "West",
    aliases: ["goa"], neighbours: ["maharashtra", "karnataka"] },
  { slug: "gujarat", name: "Gujarat", kind: "state", iso: "IN-GJ", lgd: 24, cckp: "IND.11512", region: "West",
    aliases: ["gujarat"], neighbours: ["rajasthan", "madhya-pradesh", "maharashtra", "dnh-dd"] },
  { slug: "haryana", name: "Haryana", kind: "state", iso: "IN-HR", lgd: 6, cckp: "IND.11513", region: "North",
    aliases: ["haryana"], neighbours: ["punjab", "himachal-pradesh", "uttar-pradesh", "rajasthan", "delhi", "chandigarh"] },
  { slug: "himachal-pradesh", name: "Himachal Pradesh", kind: "state", iso: "IN-HP", lgd: 2, cckp: "IND.11514", region: "North",
    aliases: ["himachal pradesh"], neighbours: ["jammu-kashmir", "ladakh", "punjab", "haryana", "uttarakhand"] },
  { slug: "jammu-kashmir", name: "Jammu and Kashmir", kind: "ut-legislature", iso: "IN-JK", lgd: 1, cckp: null, region: "North",
    aliases: ["jammu and kashmir", "jammu kashmir", "j and k", "jammu and kashmir after ladakh was separated", "jammu and kashmir ut", "jammu and kashmir union territory"], neighbours: ["ladakh", "himachal-pradesh", "punjab"], since: "2019-10-31", seam: "jk-2019" },
  { slug: "jharkhand", name: "Jharkhand", kind: "state", iso: "IN-JH", lgd: 20, cckp: "IND.11516", region: "East",
    aliases: ["jharkhand"], neighbours: ["bihar", "uttar-pradesh", "chhattisgarh", "odisha", "west-bengal"] },
  { slug: "karnataka", name: "Karnataka", kind: "state", iso: "IN-KA", lgd: 29, cckp: "IND.11517", region: "South",
    aliases: ["karnataka"], neighbours: ["goa", "maharashtra", "telangana", "andhra-pradesh", "tamil-nadu", "kerala"] },
  { slug: "kerala", name: "Kerala", kind: "state", iso: "IN-KL", lgd: 32, cckp: "IND.11518", region: "South",
    aliases: ["kerala", "keralam"], neighbours: ["karnataka", "tamil-nadu", "puducherry"] },
  { slug: "ladakh", name: "Ladakh", kind: "ut", iso: "IN-LA", lgd: 37, cckp: null, region: "North",
    aliases: ["ladakh"], neighbours: ["jammu-kashmir", "himachal-pradesh"], since: "2019-10-31", seam: "jk-2019" },
  { slug: "lakshadweep", name: "Lakshadweep", kind: "ut", iso: "IN-LD", lgd: 31, cckp: "IND.11519", region: "Islands",
    aliases: ["lakshadweep"], neighbours: [] },
  { slug: "madhya-pradesh", name: "Madhya Pradesh", kind: "state", iso: "IN-MP", lgd: 23, cckp: "IND.11520", region: "Central",
    aliases: ["madhya pradesh"], neighbours: ["rajasthan", "uttar-pradesh", "chhattisgarh", "maharashtra", "gujarat"] },
  { slug: "maharashtra", name: "Maharashtra", kind: "state", iso: "IN-MH", lgd: 27, cckp: "IND.11521", region: "West",
    aliases: ["maharashtra"], neighbours: ["gujarat", "madhya-pradesh", "chhattisgarh", "telangana", "karnataka", "goa", "dnh-dd"] },
  { slug: "manipur", name: "Manipur", kind: "state", iso: "IN-MN", lgd: 14, cckp: "IND.11522", region: "North-east",
    aliases: ["manipur"], neighbours: ["nagaland", "assam", "mizoram"] },
  { slug: "meghalaya", name: "Meghalaya", kind: "state", iso: "IN-ML", lgd: 17, cckp: "IND.11523", region: "North-east",
    aliases: ["meghalaya"], neighbours: ["assam"] },
  { slug: "mizoram", name: "Mizoram", kind: "state", iso: "IN-MZ", lgd: 15, cckp: "IND.11524", region: "North-east",
    aliases: ["mizoram"], neighbours: ["assam", "manipur", "tripura"] },
  { slug: "nagaland", name: "Nagaland", kind: "state", iso: "IN-NL", lgd: 13, cckp: "IND.11525", region: "North-east",
    aliases: ["nagaland"], neighbours: ["assam", "arunachal-pradesh", "manipur"] },
  { slug: "odisha", name: "Odisha", kind: "state", iso: "IN-OD", lgd: 21, cckp: "IND.11526", region: "East",
    aliases: ["odisha", "orissa"], neighbours: ["west-bengal", "jharkhand", "chhattisgarh", "andhra-pradesh"] },
  { slug: "puducherry", name: "Puducherry", kind: "ut-legislature", iso: "IN-PY", lgd: 34, cckp: "IND.11527", region: "South",
    aliases: ["puducherry", "pondicherry", "puduchery", "puducherry ut"], neighbours: ["tamil-nadu", "kerala", "andhra-pradesh"] },
  { slug: "punjab", name: "Punjab", kind: "state", iso: "IN-PB", lgd: 3, cckp: "IND.11528", region: "North",
    aliases: ["punjab"], neighbours: ["jammu-kashmir", "himachal-pradesh", "haryana", "rajasthan", "chandigarh"] },
  { slug: "rajasthan", name: "Rajasthan", kind: "state", iso: "IN-RJ", lgd: 8, cckp: "IND.11529", region: "North",
    aliases: ["rajasthan"], neighbours: ["punjab", "haryana", "uttar-pradesh", "madhya-pradesh", "gujarat"] },
  { slug: "sikkim", name: "Sikkim", kind: "state", iso: "IN-SK", lgd: 11, cckp: "IND.11530", region: "North-east",
    aliases: ["sikkim"], neighbours: ["west-bengal"] },
  { slug: "tamil-nadu", name: "Tamil Nadu", kind: "state", iso: "IN-TN", lgd: 33, cckp: "IND.11531", region: "South",
    aliases: ["tamil nadu", "tamilnadu"], neighbours: ["kerala", "karnataka", "andhra-pradesh", "puducherry"] },
  { slug: "telangana", name: "Telangana", kind: "state", iso: "IN-TS", lgd: 36, cckp: "IND.11532", region: "South",
    aliases: ["telangana"], neighbours: ["maharashtra", "chhattisgarh", "andhra-pradesh", "karnataka"], since: "2014-06-02", seam: "ap-2014" },
  { slug: "tripura", name: "Tripura", kind: "state", iso: "IN-TR", lgd: 16, cckp: "IND.11533", region: "North-east",
    aliases: ["tripura"], neighbours: ["assam", "mizoram"] },
  { slug: "uttar-pradesh", name: "Uttar Pradesh", kind: "state", iso: "IN-UP", lgd: 9, cckp: "IND.11534", region: "North",
    aliases: ["uttar pradesh"], neighbours: ["uttarakhand", "haryana", "delhi", "rajasthan", "madhya-pradesh", "chhattisgarh", "jharkhand", "bihar"] },
  { slug: "uttarakhand", name: "Uttarakhand", kind: "state", iso: "IN-UK", lgd: 5, cckp: "IND.11535", region: "North",
    aliases: ["uttarakhand", "uttaranchal"], neighbours: ["himachal-pradesh", "uttar-pradesh"] },
  { slug: "west-bengal", name: "West Bengal", kind: "state", iso: "IN-WB", lgd: 19, cckp: "IND.11536", region: "East",
    aliases: ["west bengal"], neighbours: ["sikkim", "assam", "bihar", "jharkhand", "odisha"] },
];

// Units that no longer exist. Never profiled; their figures appear on the successor's
// profile only under these names, and never joined to the successor's series.
export const FORMER = [
  { slug: "andhra-pradesh-undivided", name: "undivided Andhra Pradesh", until: "2014-06-01", seam: "ap-2014", successors: ["andhra-pradesh", "telangana"],
    aliases: ["undivided andhra pradesh", "andhra pradesh undivided", "erstwhile andhra pradesh", "combined andhra pradesh", "andhra pradesh before telangana was separated"] },
  { slug: "jammu-kashmir-state", name: "the former state of Jammu and Kashmir (with Ladakh)", until: "2019-10-30", seam: "jk-2019", successors: ["jammu-kashmir", "ladakh"],
    aliases: ["jammu and kashmir including ladakh", "jammu and kashmir incl ladakh", "jammu and kashmir and ladakh", "erstwhile jammu and kashmir", "jammu and kashmir state with ladakh", "jammu and kashmir before ladakh was separated"] },
  { slug: "dadra-nagar-haveli", name: "Dadra and Nagar Haveli (before the 2020 merger)", until: "2020-01-25", seam: "dnhdd-2020", successors: ["dnh-dd"],
    iso: "IN-DN", lgd: 26, cckp: "IND.1158",
    aliases: ["dadra and nagar haveli", "dadra nagar haveli", "dadra and nagar havelli", "dadra nagar havelli", "dadar and nagar haveli", "dadra and nagar haveli ut", "d and n haveli"] },
  { slug: "daman-diu", name: "Daman and Diu (before the 2020 merger)", until: "2020-01-25", seam: "dnhdd-2020", successors: ["dnh-dd"],
    iso: "IN-DD", lgd: 25, cckp: "IND.1159",
    aliases: ["daman and diu", "daman diu"] },
];

// Geography labels that are not one state: the national total and the groupings sources
// publish beside states. A label naming one of these is placed as that aggregate, never as
// a state. Order matters only through alias length (longest wins).
export const AGGREGATES = [
  { slug: "india", name: "All India", aliases: ["all india", "all-india", "india", "all states", "all states and uts", "total", "grand total", "national"] },
  { slug: "zone", name: "a region of several states", aliases: [
    "northern region", "north eastern region", "north-eastern region", "eastern region", "central region", "western region", "southern region",
    "north east", "north-east", "north eastern states", "ne states", "other uts", "other states", "union territories", "all uts", "uts",
    "north eastern", "special category states", "general category states", "non special category states", "states and uts"] },
];

/* ---------- matching ---------- */

export function normalise(s) {
  return String(s ?? "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/_+/g, " ")
    .replace(/\./g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

const ENTRIES = [
  ...STATES.map((u) => ({ slug: u.slug, type: "state", unit: u })),
  ...FORMER.map((u) => ({ slug: u.slug, type: "former", unit: u })),
];
const ALIASES = [];
for (const e of ENTRIES) for (const a of [e.unit.name, ...(e.unit.aliases ?? [])]) ALIASES.push({ a: normalise(a), slug: e.slug, type: e.type });
const seen = new Map();
for (const x of ALIASES) {
  const prev = seen.get(x.a);
  if (prev && prev !== x.slug) throw new Error(`states-key: alias "${x.a}" names both ${prev} and ${x.slug}`);
  seen.set(x.a, x.slug);
}
// aliases by first word, longest first: placeAll walks the words once, taking the longest
// alias that starts at each word
const BY_FIRST = new Map();
for (const x of [...new Map(ALIASES.map((x) => [x.a, x])).values()]) {
  const w = x.a.split(" ");
  const k = w[0];
  if (!BY_FIRST.has(k)) BY_FIRST.set(k, []);
  BY_FIRST.get(k).push({ ...x, w });
}
for (const v of BY_FIRST.values()) v.sort((p, q) => q.w.length - p.w.length);

export const BY_SLUG = new Map(STATES.map((u) => [u.slug, u]));
export const FORMER_BY_SLUG = new Map(FORMER.map((u) => [u.slug, u]));
export const unit = (slug) => BY_SLUG.get(slug) ?? FORMER_BY_SLUG.get(slug) ?? null;

// Every unit named in a text, in order of appearance: [{ slug, type: state|former, at }]
export function placeAll(text) {
  const t = normalise(text);
  if (!t) return [];
  const words = t.split(" ");
  const out = [];
  for (let i = 0; i < words.length; i++) {
    const cands = BY_FIRST.get(words[i]);
    if (!cands) continue;
    const hit = cands.find((c) => c.w.every((x, j) => words[i + j] === x));
    if (!hit) continue;
    out.push({ slug: hit.slug, type: hit.type, at: i });
    i += hit.w.length - 1;
  }
  return out;
}

// The one unit a label names, or null when it names none. Throws when it names two
// different units: a label like that needs a source-specific reader.
export function place(text) {
  const hits = [...new Set(placeAll(text).map((h) => h.slug))];
  if (hits.length > 1) throw new Error(`states-key: "${text}" names more than one unit (${hits.join(", ")})`);
  return hits[0] ?? null;
}

// The aggregate a label names (india | zone), or null.
export function placeAggregate(text) {
  const t = ` ${normalise(text)} `;
  for (const g of AGGREGATES) for (const a of g.aliases) if (t.includes(` ${normalise(a)} `)) return g.slug;
  return null;
}

// Strict: a state slug, or "former:<slug>", or "aggregate:<slug>"; throws on a label it
// cannot place. Use this in any reader of a state-cut source.
export function placeStrict(text, where = "") {
  const s = place(text);
  if (s) return FORMER_BY_SLUG.has(s) ? `former:${s}` : s;
  const g = placeAggregate(text);
  if (g) return `aggregate:${g}`;
  throw new Error(`states-key: cannot place "${text}"${where ? ` (${where})` : ""}`);
}

// Which side of a boundary seam a dated figure for `slug` sits on. A figure dated before
// the unit existed is the old unit's, unless the source carries the successor beside it
// for that date (MoSPI publishes Telangana from 2011-12, so its Andhra Pradesh is the
// residual state throughout). Returns "current" or the former unit's slug.
export function sideOfSeam(slug, dateIso, { successorHasValue = false } = {}) {
  const u = BY_SLUG.get(slug);
  if (!u?.since || dateIso >= u.since) return "current";
  if (successorHasValue) return "current";
  const seam = SEAMS.find((s) => s.id === u.seam);
  const old = Array.isArray(seam.old) ? null : seam.old;
  return old ?? "none";   // a merged unit has no single predecessor: its pre-merger figures are not its own
}

// The first unit a hierarchical label names ("West Bengal, Koch Bihar": a state, then its
// district). Only for sources whose labels run state first, then a finer place.
export function placeFirst(text) {
  return placeAll(text)[0]?.slug ?? null;
}
