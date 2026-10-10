// src/dossiers/nfhs.data.js: build-time reader for the Family health guide
// (src/pages/guides/nfhs.astro). The guide draws on 37 bundles (21 tables x two rounds), several
// of them half a megabyte; importing them into the client would blow the page budget
// (docs/CONTRACT-render.md). The page reads them here at build time, computes the figures its
// copy names, and embeds only what each plate draws as one inline JSON block that
// src/dossiers/nfhs.client.js reads. No runtime fetch; every value is a bundle's own.
//
// The two rounds are two rulers (data/sources.yml seams: nfhs). Nothing here joins them into a
// series: a plate puts the NFHS-4 value beside the NFHS-5 value, and only where the NFHS-4
// sub-indicator was baked (the adapter withholds the ones MoSPI's API misfiles).
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const cache = new Map();
export function load(slug) {
  if (!cache.has(slug)) {
    const f = path.join(ROOT, "data/series", slug + ".json");
    cache.set(slug, fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, "utf8")) : null);
  }
  return cache.get(slug);
}
export const bundleOf = (round, table) => load(`nfhs-${round}-${table}`);

/** every series of a round's table matching a sub-indicator pattern, in one sector */
function cells(round, table, sub, sector = "total") {
  const b = bundleOf(round, table);
  if (!b) return [];
  return Object.entries(b.series).filter(([, s]) => sub.test(s.group) && s.sector === sector)
    .map(([key, s]) => ({ key, geo: GEO_NAME[s.geo] ?? s.geo, label: s.group, value: s.data[0], caution: !!s.flags?.caution }));
}
// MoSPI's copy spells Puducherry "Puduchery"; the page uses the official spelling (the bundle keeps the source's)
const GEO_NAME = { Puduchery: "Puducherry" };
/** one value: All India unless a place is named; null when the round has no figure */
export function val(round, table, sub, { geo = "All India", sector = "total" } = {}) {
  const c = cells(round, table, sub, sector).filter((x) => x.geo === geo);
  if (c.length > 1) throw new Error(`nfhs.data: ${table} ${sub} matches ${c.length} sub-indicators`);
  return c[0]?.value ?? null;
}
/** the label the bundle gives a sub-indicator */
export function labelOf(table, sub) {
  for (const r of [5, 4]) { const c = cells(r, table, sub); if (c.length) return c[0].label; }
  throw new Error(`nfhs.data: no sub-indicator ${sub} in ${table}`);
}
/** every state and UT of a round (All India excluded), highest first */
export function states(round, table, sub, sector = "total") {
  return cells(round, table, sub, sector).filter((c) => c.geo !== "All India").sort((a, b) => b.value - a.value);
}
export const r1 = (v) => (v == null ? null : Math.round(v * 10) / 10);
export const f1 = (v) => (v == null ? "–" : v.toFixed(1));

/* ---------- a plate's rows ---------- */
// dumbbell rows: label, NFHS-4 (or null), NFHS-5, for All India in one sector
export function pairs(defs, sector = "total") {
  return defs.map(([table, sub, label]) => ({ label, table, a: val(4, table, sub, { sector }), b: val(5, table, sub, { sector }) }))
    .filter((r) => r.b != null);
}
// rural and urban, NFHS-5
export function ruralUrban(defs) {
  return defs.map(([table, sub, label]) => ({ label, table, rural: val(5, table, sub, { sector: "rural" }), urban: val(5, table, sub, { sector: "urban" }), total: val(5, table, sub) }))
    .filter((r) => r.rural != null && r.urban != null);
}
// one state strip per sub-indicator: every state's NFHS-5 value, with NFHS-4 where it exists
export function strip(table, sub, sector = "total") {
  const five = states(5, table, sub, sector), four = new Map(states(4, table, sub, sector).map((c) => [c.geo, c.value]));
  return { allIndia: val(5, table, sub, { sector }), allIndia4: val(4, table, sub, { sector }),
    rows: five.map((c) => ({ geo: c.geo, v: c.value, v4: four.get(c.geo) ?? null, caution: c.caution })) };
}

/* ---------- the direction of change: every sub-indicator measured in both rounds ---------- */
// per-cent sub-indicators only (a rate per 1,000 or a rupee amount cannot sit on the same axis),
// All India, total; the NFHS-4 value is the baked one, so withheld sub-indicators drop out
export function directionRows() {
  const out = [];
  for (const table of TABLE_ORDER) {
    const b5 = bundleOf(5, table), b4 = bundleOf(4, table);
    if (!b5 || !b4) continue;
    const subs = new Map();
    for (const s of Object.values(b5.series)) if (s.geo === "All India" && s.sector === "total" && s.unit === "percent") subs.set(s.group, s.data[0]);
    for (const s of Object.values(b4.series)) if (s.geo === "All India" && s.sector === "total" && s.unit === "percent" && subs.has(s.group)) {
      out.push({ table, label: s.group, a: s.data[0], b: subs.get(s.group), change: r1(subs.get(s.group) - s.data[0]) });
    }
  }
  return out;
}
export const TABLE_ORDER = ["household", "adults", "marriage-fertility", "mortality", "family-planning", "unmet-need", "fp-quality", "maternity", "delivery",
  "vaccination", "childhood-disease", "child-nutrition", "adult-nutrition", "anaemia", "blood-sugar", "blood-pressure", "cancer-screening",
  "hiv-knowledge", "empowerment", "violence", "tobacco-alcohol"];

/** the withheld NFHS-4 sub-indicators, from the bundles' own meta (for the guide's disclosure) */
export function withheld() {
  const out = [];
  for (const t of TABLE_ORDER) for (const q of bundleOf(5, t)?.meta.nfhs4Withheld ?? []) out.push({ table: t, ...q });
  return out;
}

/* ---------- short names for charts (the bundles keep the fact sheet's full wording) ---------- */
const SHORT = [
  [/^Female population age 6 years and above who ever attended school/, "Girls and women 6+ who ever went to school"],
  [/^Population below age 15/, "Population under 15"],
  [/^Sex ratio of the total population/, "Women per 1,000 men"],
  [/^Sex ratio at birth/, "Girls born per 1,000 boys, last five years"],
  [/birth was registered/, "Births registered, under-5s"],
  [/households with electricity/, "Living with electricity"],
  [/improved drinking-water/, "Improved drinking water"],
  [/improved sanitation/, "Improved toilet"],
  [/clean fuel for cooking/, "Households cooking with clean fuel"],
  [/iodized salt/, "Households using iodised salt"],
  [/health insurance/, "Households with health insurance"],
  [/^Deaths in the last 3 years registered/, "Deaths registered"],
  [/pre-primary school/, "Five-year-olds in pre-school"],
  [/^Women \(age 15-49\) who are literate/, "Women literate"],
  [/^Men \(age 15-49\) who are literate/, "Men literate"],
  [/^Women \(age 15-49\) with 10 or more years/, "Women with 10+ years of school"],
  [/^Men \(age 15-49\) with 10 or more years/, "Men with 10+ years of school"],
  [/^Women \(age 15-49\) who have ever used the internet/, "Women who have used the internet"],
  [/^Men \(age 15-49\) who have ever used the internet/, "Men who have used the internet"],
  [/^Women age 20-24 years married before age 18/, "Women 20-24 married before 18"],
  [/^Men age 25-29 years married before age 21/, "Men 25-29 married before 21"],
  [/^Total Fertility Rate/, "Children per woman (TFR)"],
  [/already mothers or pregnant/, "Girls 15-19 already mothers or pregnant"],
  [/^Adolescent fertility rate/, "Births per 1,000 girls 15-19"],
  [/^Infant mortality/, "Infant deaths per 1,000 births"],
  [/^Under-five mortality/, "Under-five deaths per 1,000 births"],
  [/^Neonatal mortality/, "Newborn deaths per 1,000 births"],
  [/family planning: Any method/, "Married women using any method"],
  [/family planning: Any modern method/, "Using a modern method"],
  [/family planning: Female sterilization/, "Female sterilisation"],
  [/family planning: Male sterilization/, "Male sterilisation"],
  [/family planning: IUD/, "IUD"],
  [/family planning: Pill/, "Pill"],
  [/family planning: Condom/, "Condom"],
  [/family planning: Injectables/, "Injectables"],
  [/^Total Unmet need/, "Unmet need for family planning"],
  [/^Unmet need for spacing/, "Unmet need for spacing"],
  [/^Health worker ever talked/, "Health worker talked to non-users"],
  [/told about side effects/, "Users told about side effects"],
  [/antenatal check-up in the first trimester/, "Antenatal check in first three months"],
  [/at least 4 antenatal/, "Four or more antenatal visits"],
  [/neonatal tetanus/, "Protected against neonatal tetanus"],
  [/iron folic acid for 100 days/, "Iron and folic acid, 100+ days"],
  [/iron folic acid for 180 days/, "Iron and folic acid, 180+ days"],
  [/Mother and Child Protection/, "Mother and Child Protection card"],
  [/^Mothers who received postnatal care/, "Mothers checked within 2 days"],
  [/out-of-pocket expenditure/, "Out-of-pocket cost of a delivery, public facility"],
  [/^Children born at home who were taken/, "Home-born babies checked within 24 hours"],
  [/^Children who received postnatal care/, "Babies checked within 2 days"],
  [/full antenatal care/, "Full antenatal care"],
  [/Janani Suraksha Yojana/, "Janani Suraksha Yojana payment"],
  [/^Institutional births \(in the 5/, "Births in a health facility"],
  [/^Institutional births in public facility/, "Births in a public facility"],
  [/^Home births that were conducted by skilled/, "Home births with a skilled attendant"],
  [/^Births attended by skilled/, "Births with a skilled attendant"],
  [/^Births delivered by caesarean/, "Caesarean births"],
  [/^Births in a private health facility that were delivered by caesarean/, "Caesarean share, private facilities"],
  [/^Births in a public health facility that were delivered by caesarean/, "Caesarean share, public facilities"],
  [/vitamin A dose/, "Vitamin A, last 6 months"],
  [/vaccinations in a public health facility/, "Vaccinated mostly in public facilities"],
  [/vaccinations in a private health facility/, "Vaccinated mostly in private facilities"],
  [/fully immunized \(BCG/, "Fully immunised (NFHS-4 definition)"],
  [/received BCG/, "BCG"],
  [/3 doses of polio/, "Polio, 3 doses"],
  [/3 doses of penta or DPT/, "DPT or penta, 3 doses"],
  [/first dose of measles/, "Measles, first dose"],
  [/3 doses of penta or hepatitis B/, "Hepatitis B or penta, 3 doses"],
  [/fully vaccinated based on information from either/, "Fully vaccinated (card or recall)"],
  [/fully vaccinated based on information from vaccination card only/, "Fully vaccinated (card only)"],
  [/second dose of measles/, "Measles, second dose"],
  [/rotavirus/, "Rotavirus, 3 doses"],
  [/^Prevalence of diarrhoea/, "Had diarrhoea, last 2 weeks"],
  [/received oral rehydration salts/, "Diarrhoea treated with ORS"],
  [/received zinc/, "Diarrhoea treated with zinc"],
  [/diarrhoea .*taken to a health facility/, "Diarrhoea taken to a provider"],
  [/^Prevalence of symptoms of acute respiratory/, "Had a respiratory infection, last 2 weeks"],
  [/fever or symptoms of ARI/, "Fever or infection taken to a provider"],
  [/breastfed within one hour/, "Breastfed in the first hour"],
  [/exclusively breastfed/, "Exclusively breastfed, under 6 months"],
  [/solid or semi-solid food and breastmilk/, "Solid food and breastmilk, 6-8 months"],
  [/^Breastfeeding children age 6-23 months receiving an adequate diet/, "Adequate diet, breastfed 6-23 months"],
  [/^Non-breastfeeding children/, "Adequate diet, not breastfed"],
  [/^Total children age 6-23 months receiving an adequate diet/, "Adequate diet, 6-23 months"],
  [/are stunted/, "Children stunted"],
  [/are wasted/, "Children wasted"],
  [/severely wasted/, "Children severely wasted"],
  [/are underweight/, "Children underweight"],
  [/Children under 5 years who are overweight/, "Children overweight"],
  [/^Women .*below normal/, "Women underweight (BMI below 18.5)"],
  [/^Men .*below normal/, "Men underweight (BMI below 18.5)"],
  [/^Women .*overweight or obese/, "Women overweight or obese"],
  [/^Men .*overweight or obese/, "Men overweight or obese"],
  [/^Women .*waist-to-hip/, "Women, high-risk waist"],
  [/^Men .*waist-to-hip/, "Men, high-risk waist"],
  [/^Children age 6-59 months who are anaemic/, "Children 6-59 months, anaemic"],
  [/^Non-pregnant women/, "Women not pregnant, anaemic"],
  [/^Pregnant women/, "Pregnant women, anaemic"],
  [/^All women age 15-49/, "All women 15-49, anaemic"],
  [/^All women age 15-19/, "Girls 15-19, anaemic"],
  [/^Men age 15-49 years who are anaemic/, "Men 15-49, anaemic"],
  [/^Men age 15-19 years who are anaemic/, "Boys 15-19, anaemic"],
  [/^Women .*with high \(141-160/, "Women, blood sugar 141-160"],
  [/^Women .*very high \(>160/, "Women, blood sugar above 160"],
  [/^Men .*with high \(141-160/, "Men, blood sugar 141-160"],
  [/^Men .*very high \(>160/, "Men, blood sugar above 160"],
  [/^Women .*taking medicine to control blood sugar/, "Women, high blood sugar or on medicine"],
  [/^Men .*taking medicine to control blood sugar/, "Men, high blood sugar or on medicine"],
  [/^Women .*Mildly elevated/, "Women, blood pressure mildly high"],
  [/^Women .*Moderately or severely/, "Women, blood pressure very high"],
  [/^Women .*Elevated blood pressure/, "Women, high blood pressure or on medicine"],
  [/^Men .*Mildly elevated/, "Men, blood pressure mildly high"],
  [/^Men .*Moderately or severely/, "Men, blood pressure very high"],
  [/^Men .*Elevated blood pressure/, "Men, high blood pressure or on medicine"],
  [/cervical cancer/, "Women 30-49, ever screened for cervical cancer"],
  [/breast examination/, "Women 30-49, ever had a breast examination"],
  [/^Women .*oral cavity/, "Women 30-49, ever had a mouth examination"],
  [/^Men .*oral cavity/, "Men 30-49, ever had a mouth examination"],
  [/^Women .*comprehensive knowledge/, "Women who know the basics of HIV"],
  [/^Men .*comprehensive knowledge/, "Men who know the basics of HIV"],
  [/^Women .*consistent condom/, "Women who know condoms protect"],
  [/^Men .*consistent condom/, "Men who know condoms protect"],
  [/three household decisions/, "Married women in household decisions"],
  [/paid in cash/, "Women who worked and were paid in cash"],
  [/house and\/or land/, "Women owning a house or land"],
  [/bank or savings account/, "Women with a bank account they use"],
  [/mobile phone/, "Women with a phone they use"],
  [/hygienic methods/, "Young women using hygienic period protection"],
  [/spousal violence/, "Married women ever hurt by a husband"],
  [/violence during any pregnancy/, "Hurt during a pregnancy"],
  [/sexual violence by age 18/, "Young women sexually abused before 18"],
  [/^Women .*use any kind of tobacco/, "Women using tobacco"],
  [/^Men .*use any kind of tobacco/, "Men using tobacco"],
  [/^Women .*consume alcohol/, "Women drinking alcohol"],
  [/^Men .*consume alcohol/, "Men drinking alcohol"],
  [/^Women who tried to stop/, "Women who tried to quit tobacco"],
  [/^Men who tried to stop/, "Men who tried to quit tobacco"],
];
export function short(label) {
  for (const [re, s] of SHORT) if (re.test(label)) return s;
  throw new Error(`nfhs.data: no short name for "${label}"`);
}

/* ---------- which way is better ----------
 * +1: a rise is good for the household (more children vaccinated); -1: a rise is bad (more
 * children stunted); 0: the survey cannot say (a caesarean is sometimes the right care, a
 * private facility is a choice). The editor's judgement, printed on the plate that uses it. */
const WORSE = /stunted|wasted|underweight|overweight|below normal|anaemic|Unmet need|diarrhoea, last|respiratory infection, last|married before|already mothers|deaths|Births per 1,000 girls|high-risk waist|blood sugar|blood pressure|hurt|abused|tobacco|alcohol|Out-of-pocket/i;
const NEUTRAL = /Caesarean|private facilities|Home births with a skilled|Population under 15|Women per 1,000 men|Children per woman|sterilisation|^IUD$|^Pill$|^Condom$|^Injectables$|Vaccinated mostly in public/i;
export function polarity(shortName) {
  if (/tried to quit/.test(shortName)) return 1;
  if (NEUTRAL.test(shortName)) return 0;
  if (WORSE.test(shortName)) return -1;
  return 1;
}
