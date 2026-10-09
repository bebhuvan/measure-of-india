// pipeline/lib/facts-health-gender.mjs: the facts sheets for the two survey guides, Family
// health (nfhs) and Women and men (gender). pipeline/facts.mjs hands a dossier here when its
// registry entry names this module (`factsModule`).
//
// Why a module of its own: facts.mjs reads one current bundle as a time series (latest,
// previous, year ago). Neither guide has one. NFHS is two survey rounds, each its own bundle
// and ruler; the compendium is 180 bundles from a dozen agencies on as many calendars. So the
// sheet is assembled here, figure by figure, in the shape generate.mjs, verify.mjs and
// contract.mjs read: `series` entries with latest and previous (each with its own period and
// ruler), and `cross` blocks of figures computed in code (shares, gaps, counts, extremes) so
// the writer never does arithmetic. A "previous" value is given only on the same ruler or
// the agency's own earlier round of the same measure, and its period always says which.
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const r1 = (v) => (v == null ? null : Math.round(v * 10) / 10);
const r2 = (v) => (v == null ? null : Math.round(v * 100) / 100);

export default async function buildFacts(slug, ROOT, D) {
  const B = new Map();
  const load = (b) => { if (!B.has(b)) B.set(b, JSON.parse(fs.readFileSync(path.join(ROOT, "data/series", b + ".json"), "utf8"))); return B.get(b); };
  const cur = load(D.currentBundle);
  const facts = {
    dossier: slug, bundle: D.currentBundle, base: cur.meta.base, vintage: cur.meta.vintage, releaseDate: cur.meta.releaseDate ?? null, bands: null,
    ruler: { bundle: D.currentBundle, base: cur.meta.base, product: slug, note: "assembled from several bundles; each series names its own ruler" },
    series: {}, cross: {},
  };
  const entry = (label, ruler, latest, previous = null, extra = {}) => ({
    label, ruler, levelBased: false, ...extra,
    latest, previous,
    deltaVsPrev: previous && latest.value != null && previous.value != null ? r2(latest.value - previous.value) : null,
    streaks: { negative: 0 },
  });
  if (slug === "nfhs") nfhs(facts, load, entry, ROOT, await import(pathToFileURL(path.join(ROOT, "src/dossiers/nfhs.data.js")).href));
  else if (slug === "gender") gender(facts, load, entry);
  else throw new Error(`facts-health-gender: no sheet for "${slug}"`);
  return facts;
}

/* ---------- Family health: NFHS-5 beside NFHS-4 ---------- */
function nfhs(facts, load, entry, ROOT, page) {
  const R5 = "NFHS-5, 2019-21", R4 = "NFHS-4, 2015-16";
  facts.latestPeriod = "2019-21";
  const getS = (round, table, re, geo = "All India", sector = "total") => {
    let b; try { b = load(`nfhs-${round}-${table}`); } catch { return null; }
    const hits = Object.values(b.series).filter((x) => re.test(x.group) && x.geo === geo && x.sector === sector);
    if (hits.length > 1) throw new Error(`facts-health-gender: ${table} ${re} matches ${hits.length} sub-indicators`);
    return hits[0] ?? null;
  };
  const get = (...a) => getS(...a)?.data[0] ?? null;
  // why a measure has no NFHS-4 figure: the NFHS-5 bundle names the withheld lines and why
  const whyNo4 = (table, re) => {
    const w = (load(`nfhs-5-${table}`).meta.nfhs4Withheld ?? []).find((x) => re.test(x.sub));
    if (!w) return "MoSPI's copy of the survey has no NFHS-4 figure for this measure";
    return w.kind === "misfiled" ? "NFHS-4 did measure this, but MoSPI's copy files another line's figure here, so the guide withholds it" : "NFHS-4 measured a different age group or asked a different question, so the two rounds are not compared";
  };
  const pair = (key, label, table, re, unitWord = "per cent") => {
    // the NFHS-4 value counts only if it is the same sub-indicator (a loose pattern once matched
    // NFHS-4's "tried to stop using tobacco" for "uses tobacco")
    const s5 = getS(5, table, re), s4 = getS(4, table, re);
    const v5 = s5?.data[0] ?? null, v4 = s4 && s5 && s4.group === s5.group ? s4.data[0] : null;
    facts.series[key] = entry(label, `NFHS rounds, nfhs-5-${table} and nfhs-4-${table}`, { value: r2(v5), period: R5 },
      v4 == null ? null : { value: r2(v4), period: R4 }, { unit: unitWord, ...(v4 == null ? { noEarlierRound: whyNo4(table, re) } : {}) });
  };
  pair("child_anaemia", "Children 6-59 months who are anaemic", "anaemia", /^Children age 6-59/);
  pair("women_anaemia", "All women 15-49 who are anaemic", "anaemia", /^All women age 15-49/);
  pair("men_anaemia", "Men 15-49 who are anaemic", "anaemia", /^Men age 15-49/);
  pair("stunting", "Children under 5 who are stunted", "child-nutrition", /are stunted/);
  pair("wasting", "Children under 5 who are wasted", "child-nutrition", /are wasted/);
  pair("underweight", "Children under 5 who are underweight", "child-nutrition", /are underweight/);
  pair("infant_mortality", "Infant deaths per 1,000 live births", "mortality", /^Infant/, "per 1,000 live births");
  pair("institutional_births", "Births in a health facility", "delivery", /^Institutional births \(in/);
  pair("caesarean_births", "Births by caesarean section", "delivery", /^Births delivered by caesarean/);
  pair("full_vaccination", "Children 12-23 months fully vaccinated (card or recall)", "vaccination", /fully vaccinated based on information from either/);
  pair("women_high_bp", "Women 15+ with high blood pressure or taking medicine for it", "blood-pressure", /^Women .*Elevated blood pressure \(Systolic ≥140/);
  pair("men_high_bp", "Men 15+ with high blood pressure or taking medicine for it", "blood-pressure", /^Men .*Elevated blood pressure \(Systolic ≥140/);
  pair("women_high_sugar", "Women 15+ with high blood sugar or taking medicine for it", "blood-sugar", /^Women .*taking medicine/);
  pair("men_high_sugar", "Men 15+ with high blood sugar or taking medicine for it", "blood-sugar", /^Men .*taking medicine/);
  pair("cervical_screening", "Women 30-49 ever screened for cervical cancer", "cancer-screening", /cervical/);
  pair("women_bank_account", "Women 15-49 with a bank account they use", "empowerment", /bank or savings/);
  pair("women_phone", "Women 15-49 with a mobile phone they use", "empowerment", /mobile phone/);
  pair("spousal_violence", "Ever-married women 18-49 ever hurt by a husband", "violence", /spousal violence/);
  pair("men_tobacco", "Men 15+ who use tobacco", "tobacco-alcohol", /^Men .*use any kind of tobacco/);
  pair("fertility_rate", "Children per woman (total fertility rate)", "marriage-fertility", /Total Fertility/, "children per woman");
  pair("child_marriage", "Women 20-24 married before 18", "marriage-fertility", /married before age 18/);
  pair("improved_sanitation", "Population with an improved toilet", "household", /improved sanitation/);
  pair("clean_fuel", "Households cooking with clean fuel", "household", /clean fuel/);

  // states: child anaemia rose in how many; extremes of a few headline measures (NFHS-5)
  const statesOf = (round, table, re, sector = "total") => {
    let b; try { b = load(`nfhs-${round}-${table}`); } catch { return []; }
    return Object.values(b.series).filter((x) => re.test(x.group) && x.sector === sector && x.geo !== "All India").map((x) => ({ geo: x.geo, value: x.data[0] }));
  };
  const an5 = statesOf(5, "anaemia", /^Children age 6-59/), an4 = new Map(statesOf(4, "anaemia", /^Children age 6-59/).map((x) => [x.geo, x.value]));
  const both = an5.filter((x) => an4.has(x.geo));
  const ext = (rows) => { const s = [...rows].sort((a, b) => b.value - a.value); return { highest: { state: s[0].geo, value: r2(s[0].value) }, lowest: { state: s.at(-1).geo, value: r2(s.at(-1).value) }, statesCompared: s.length }; };
  facts.cross.states = {
    note: "NFHS-5 state figures; 'statesCompared' counts the states and union territories with a figure.",
    childAnaemia: { ...ext(an5), roseSinceNFHS4: both.filter((x) => x.value > an4.get(x.geo)).length, measuredInBothRounds: both.length },
    stunting: ext(statesOf(5, "child-nutrition", /are stunted/)),
    womenHighBP: ext(statesOf(5, "blood-pressure", /^Women .*Elevated blood pressure \(Systolic ≥140/)),
    spousalViolence: ext(statesOf(5, "violence", /spousal violence/)),
    fertilityRate: { ...ext(statesOf(5, "marriage-fertility", /Total Fertility/)), aboveReplacement: statesOf(5, "marriage-fertility", /Total Fertility/).filter((x) => x.value > 2.1).length },
  };
  // villages and towns, NFHS-5
  const ru = (table, re) => ({ villages: r2(get(5, table, re, "All India", "rural")), towns: r2(get(5, table, re, "All India", "urban")) });
  facts.cross.villagesAndTowns = {
    note: "NFHS-5, India: the rural and the urban figure, per cent.",
    womenPhone: ru("empowerment", /mobile phone/), cleanFuel: ru("household", /clean fuel/), childMarriage: ru("marriage-fertility", /married before age 18/),
    womenHighBP: ru("blood-pressure", /^Women .*Elevated blood pressure \(Systolic ≥140/), stunting: ru("child-nutrition", /are stunted/),
  };
  // the direction of change: the page's own rows and judgement (src/dossiers/nfhs.data.js), so the
  // sheet and the plate count the same measures the same way
  const dirRows = page.directionRows().map((r) => ({ ...r, dir: page.polarity(page.short(r.label)) })).filter((r) => r.dir !== 0);
  const total = dirRows.length, better = dirRows.filter((r) => r.dir * r.change > 0).length;
  const worstRows = dirRows.filter((r) => r.dir * r.change < 0).sort((x, y) => x.dir * x.change - y.dir * y.change);
  const worse = worstRows.length;
  const worst = worstRows.map((r) => ({ measure: page.short(r.label), nfhs4: r2(r.a), nfhs5: r2(r.b), changePoints: r.change }));
  facts.cross.directionOfChange = {
    note: "Every per-cent measure in both rounds that has a right direction (the guide's judgement: more anaemia, stunting or violence is worse). Counts of measures, not of people.",
    measuresCompared: total, movedTheRightWay: better, movedTheWrongWay: worse, wrongWay: worst.slice(0, 5),
  };
  facts.cross.withheld = {
    note: "NFHS-4 lines MoSPI's API files against the wrong measure, or under NFHS-5's wording for a different age group; the guide does not use them.",
    ...(() => {
      const all = fs.readdirSync(path.join(ROOT, "data/series")).filter((x) => /^nfhs-5-/.test(x)).flatMap((f) => load(f.replace(/\.json$/, "")).meta.nfhs4Withheld ?? []);
      return { nfhs4LinesWithheld: all.length, misfiledByMoSPI: all.filter((w) => w.kind === "misfiled").length, differentAgeGroupOrQuestion: all.filter((w) => w.kind === "frame").length };
    })(),
    bankAccountNFHS4PerNationalReport: 53,
  };
}

/* ---------- Women and men: the compendium ---------- */
function gender(facts, load, entry) {
  const series = (b, k) => { const x = load(b), s = x.series[k]; if (!s) throw new Error(`facts-health-gender: ${b} has no ${k}`); return x.dates.map((d, i) => ({ value: s.data[i], period: x.meta.periodLabels?.[d] ?? d.slice(0, 4) })).filter((p) => p.value != null); };
  const at = (b, k, i) => { const p = series(b, k); return p.at(i); };
  const find = (b, re) => { const k = Object.keys(load(b).series).find((x) => re.test(x)); if (!k) throw new Error(`facts-health-gender: ${b} has no key ${re}`); return k; };
  const S = (key, label, b, k, opts = {}) => {
    const p = series(b, k), L = p.at(-1), P = opts.noPrevious ? null : p.at(-2) ?? null;
    facts.series[key] = entry(label, `${load(b).meta.agency ?? "MoSPI compendium"}; ${b}`, { value: r2(L.value), period: L.period }, P ? { value: r2(P.value), period: P.period } : null,
      { unit: opts.unit ?? null, ...(opts.first ? { first: { value: r2(p[0].value), period: p[0].period } } : {}) });
  };
  const srb = series("gender-t007", "total__all_india");
  facts.latestPeriod = srb.at(-1).period;   // the guide's current reading leads with the SRS sex ratio at birth
  S("sex_ratio_at_birth", "Girls born per 1,000 boys (SRS, three-year average)", "gender-t007", "total__all_india", { unit: "girls per 1,000 boys", first: true });
  S("infant_mortality_girls", "Infant deaths per 1,000 births, girls (SRS)", "gender-t015", "female__all_india", { unit: "per 1,000", first: true });
  S("infant_mortality_boys", "Infant deaths per 1,000 births, boys (SRS)", "gender-t015", "male__all_india", { unit: "per 1,000", first: true });
  S("maternal_mortality", "Maternal deaths per 1,00,000 live births (SRS)", "gender-t021", "all_india", { unit: "per 1,00,000 live births", first: true });
  // life expectancy: the last SRS window, not the projections that follow it
  {
    const b = load("gender-t018"), est = new Set(b.series.female__all_india.estimated ?? []);
    const pick = (k) => { const i = b.dates.map((d, j) => j).filter((j) => b.series[k].data[j] != null && !est.has(b.dates[j])).at(-1); return { value: b.series[k].data[i], period: b.meta.periodLabels[b.dates[i]] }; };
    facts.series.life_expectancy_women = entry("Life expectancy at birth, women (SRS)", "SRS abridged life tables; gender-t018", pick("female__all_india"), null, { unit: "years" });
    facts.series.life_expectancy_men = entry("Life expectancy at birth, men (SRS)", "SRS abridged life tables; gender-t018", pick("male__all_india"), null, { unit: "years" });
  }
  S("fertility_no_schooling", "Children per woman, mothers who never went to school (SRS)", "gender-t010", "total__illiterate__all_india", { unit: "children per woman", noPrevious: true });
  S("fertility_graduates", "Children per woman, graduate mothers (SRS)", "gender-t010", "total__literate_graduate_and_above__all_india", { unit: "children per woman", noPrevious: true });
  S("women_labour_force_2025", "Women 15+ in the labour force, PLFS 2025 (revamped design)", "gender-t082-cy25", "total__female__all_india", { noPrevious: true, unit: "per cent" });
  S("men_labour_force_2025", "Men 15+ in the labour force, PLFS 2025 (revamped design)", "gender-t082-cy25", "total__male__all_india", { noPrevious: true, unit: "per cent" });
  S("rural_casual_wage_women", "Rural casual daily wage, women, PLFS 2025 (rupees)", "gender-t087-cy25", "rural__female__all_india", { noPrevious: true, unit: "rupees a day" });
  S("rural_casual_wage_men", "Rural casual daily wage, men, PLFS 2025 (rupees)", "gender-t087-cy25", "rural__male__all_india", { noPrevious: true, unit: "rupees a day" });
  S("crimes_against_women_rate", "Crimes against women registered per 1,00,000 women (NCRB)", "gender-t141", "rates_of_crimes__total_crimes_against_women__all_india", { noPrevious: true, unit: "per 1,00,000 women" });
  S("panchayat_women_share", "Women's share of panchayat members", "gender-t127", "percentage_of_women_elected_representatives__all_india", { noPrevious: true, unit: "per cent" });
  S("lok_sabha_women_2024", "Women's share of Lok Sabha members, 2024", "gender-t125", "women__all_india", { noPrevious: true, unit: "per cent" });
  // time use: the two survey rounds, per person, unpaid work at home (2019 adds the survey's two unpaid categories)
  {
    const v19 = (sex) => at("gender-t103", `${sex}__unpaid_activity_non_sna__all_india`, -1).value + at("gender-t103", `${sex}__unpaid_activity_sna__all_india`, -1).value;
    const v24 = (sex) => at("gender-t104", `average_time_in_minutes_spent_in_a_day_per_person__${sex}__unpaid_activity__all_india`, -1).value;
    facts.series.unpaid_work_women = entry("Minutes a day of unpaid work at home, women 6+ (Time Use Survey)", "Time Use Survey 2024 and 2019 (two rounds); gender-t104, gender-t103", { value: v24("female"), period: "2024" }, { value: v19("female"), period: "2019" }, { unit: "minutes a day" });
    facts.series.unpaid_work_men = entry("Minutes a day of unpaid work at home, men 6+ (Time Use Survey)", "Time Use Survey 2024 and 2019 (two rounds); gender-t104, gender-t103", { value: v24("male"), period: "2024" }, { value: v19("male"), period: "2019" }, { unit: "minutes a day" });
  }
  // derived shares and comparisons, computed here
  const share = (p, w) => r1((100 * p) / w);
  const last = (b, k) => series(b, k).at(-1);
  const ls = series("gender-t124", "elected_female__all_india__count"), seats = new Map(series("gender-t124", "number_of_seats_available_for_election__all_india").map((p) => [p.period, p.value]));
  const lsShare = ls.filter((p) => seats.has(p.period)).map((p) => ({ period: p.period, value: share(p.value, seats.get(p.period)) }));
  const ext = (b, prefix) => {
    const x = load(b);
    const rows = Object.entries(x.series).filter(([k, s]) => k.startsWith(prefix) && s.geo && s.geo !== "All India" && !k.slice(prefix.length).includes("__"))
      .map(([, s]) => s.data.filter((v) => v != null).at(-1) != null ? { state: s.geo, value: r2(s.data.filter((v) => v != null).at(-1)) } : null).filter(Boolean).sort((a, c) => c.value - a.value);
    return { highest: rows[0], lowest: rows.at(-1), statesCompared: rows.length };
  };
  facts.cross = {
    note: "Shares are computed from the counts the compendium prints; each block names its agency and period.",
    sexRatioAtBirthStates: { period: srb.at(-1).period, ...ext("gender-t007", "total__"), statesAt950OrAbove: Object.entries(load("gender-t007").series).filter(([k, s]) => k.startsWith("total__") && s.geo !== "All India" && s.data.at(-1) >= 950).length },
    censusSexRatio: { first: at("gender-t002", "all_india", 0), lowest: series("gender-t002", "all_india").reduce((a, p) => (p.value < a.value ? p : a)), latest: at("gender-t002", "all_india", -1), note: "Women per 1,000 men in the whole population, census years; no census since 2011." },
    womenLabourForceStates: { period: "2025", ...ext("gender-t082-cy25", "total__female__") },
    crimeRateStates: { period: last("gender-t141", "rates_of_crimes__total_crimes_against_women__all_india").period, ...ext("gender-t141", "rates_of_crimes__total_crimes_against_women__") },
    lokSabhaWomenShare: { first: lsShare[0], latest: lsShare.at(-1), note: "women elected as a share of seats, computed from the compendium's counts" },
    womenShareOfAccounts: {
      janDhan: share(last("gender-t111", "female__all_india").value, last("gender-t111", "total__all_india").value),
      dematCDSL: share(last("gender-t115", "female__all_india").value, last("gender-t115", "total__all_india").value),
      individualDepositsByValue: share(last("gender-t108", "females_out_of_individuals__amount_in_crore__all_india").value, last("gender-t108", "individuals__amount_in_crore__all_india").value),
      nseIndividualInvestors: r1(last("gender-t118", "female__all_india").value),
      note: "per cent of accounts or holders in women's names, latest date each source reports (2025)",
    },
    wageGap: { womenPer100RupeesMen: Math.round((100 * last("gender-t087-cy25", "rural__female__all_india").value) / last("gender-t087-cy25", "rural__male__all_india").value), note: "rural casual daily wage, PLFS 2025" },
    convictionShareAllCrimesAgainstWomen: { value: r2(last("gender-t145", find("gender-t145", /^percentage_of_cases_convicted.*total_crimes_against_women__all_india$/)).value), note: "convictions as a share of all cases due for trial in the year, including the backlog; not the usual conviction rate", period: last("gender-t145", find("gender-t145", /^percentage_of_cases_convicted.*total_crimes_against_women__all_india$/)).period },
    spousalViolenceCompendium: { nfhs4: last("gender-t143-nfhs4", "physical_or_sexual__all_india").value, nfhs5: last("gender-t143-nfhs5", "physical_or_sexual__all_india").value, note: "married women 18-49 who experienced physical or sexual violence by a husband, NFHS reprinted in the compendium (two survey rounds)" },
    tablesBlocked: 12,
  };
}
