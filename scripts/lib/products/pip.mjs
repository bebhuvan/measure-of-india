// scripts/lib/products/pip.mjs: India in the World Bank's Poverty and Inequality
// Platform (PIP, api.worldbank.org/pip/v1), 2021 PPP, the current release.
//
// What PIP publishes for India (release 20260922, checked 2026-10-09):
//   - nine consumption surveys (NSS 1977-78 to 2011-12, HCES 2022-23 and
//     2023-24), national level only (no rural or urban rows in this release);
//   - per survey: headcount, poverty gap, severity and Watts index at any line,
//     plus the line-free distribution: mean, median, Gini, MLD, polarisation,
//     decile shares, the societal poverty line and rate, the prosperity gap,
//     population, and the PPP and CPI factors used;
//   - a "lineup": model estimates for every calendar year 1981-2026 that
//     interpolate between surveys and extrapolate past the last one (nowcasts).
//
// Comparability. PIP numbers surveys into comparable spells (survey_comparability
// / comparable_spell): 1977-78, 1983, 1987-88, 1993-94 to 2009-10 (the NSS
// "uniform reference period" schedule), 2011-12 (schedule 2, mixed reference
// period), 2022-23 to 2023-24 (the redesigned HCES). Rounds in different spells
// asked different questions over different recall periods and are different
// rulers (AGENTS.md rule 1). So: one bundle per spell, poverty-pip-<first year>,
// never joined. The lineup is the World Bank's own published bridge across the
// spells and lives in its own bundle, poverty-pip-lineup, every value a model
// estimate (registered as the agency bridge in sources.yml seams).
//
// Lines. The three international lines come from PIP's own poverty_lines table
// (2021 PPP: $3.00, $4.20, $8.30 a day). A ladder of further lines (config) gives
// the share of people below each, which draws the distribution itself.
//
// Units in the bundles: shares and rates in per cent (PIP serves fractions;
// multiplied by 100 here), money in 2021 PPP dollars a day per person as served,
// population in persons, poor counts in millions (derived: headcount x
// reporting_pop, labelled).
//
// Hand check (2026-10-09): PIP's India country profile and the API both give
// 5.25% of people below $3.00 a day in 2022 (HCES 2022-23) and 2.57% in 2023;
// WDI's SI.POV.DDAY carries 5.3 for 2022. validate.mjs cross-checks the PIP
// bundles against WDI's PIP-derived series (SI.POV.*) and the identity
// survey_mean_lcu = mean x ppp x cpi.

import { pip } from "../worldbank.mjs";
import { writeSeries, writeRaw, writeJson } from "../util.mjs";

const pct = (v) => (v == null ? null : Math.round(v * 1e6) / 1e4);   // fraction -> per cent, no float noise
const lineKey = (l) => l.toFixed(2).replace(".", "_");                    // 3 -> "3_00"
const LINE_FIELDS = { headcount: "Share of people below", poverty_gap: "Poverty gap at", poverty_severity: "Poverty severity (squared gap) at", watts: "Watts index at" };
const FREE_FIELDS = {
  mean: ["Mean consumption per person a day, 2021 PPP $", "ppp_usd_day", false],
  median: ["Median consumption per person a day, 2021 PPP $", "ppp_usd_day", false],
  gini: ["Gini index of consumption", "index_0_100", true],
  mld: ["Mean log deviation (an inequality index)", "index", false],
  polarization: ["Polarisation index", "index", false],
  spl: ["Societal poverty line, 2021 PPP $ a day", "ppp_usd_day", false],
  spr: ["Societal poverty rate", "pct", true],
  pg: ["Prosperity gap (average factor by which consumption falls short of $25 a day)", "ratio", false],
  ppp: ["PPP conversion factor used (rupees per 2021 international $)", "inr_per_ppp_usd", false],
  cpi: ["CPI relative to 2021 used by PIP (2021 = 1)", "ratio", false],
  reporting_pop: ["Population the estimate refers to", "persons", false],
};
for (let d = 1; d <= 10; d++) FREE_FIELDS["decile" + d] = [`Share of all consumption held by decile ${d} (${d === 1 ? "poorest" : d === 10 ? "richest" : "from the bottom"} tenth)`, "pct", true];

export async function buildPip(root, dcfg) {
  const versions = await pip("versions");
  const release = versions.find((v) => v.ppp_version === "2021" && v.identity === "PROD");
  if (!release) throw new Error("pip: no 2021 PPP production release in /versions");
  const linesTab = await pip("aux", { table: "poverty_lines" });
  // the lines PIP shows on its own site (is_visible): the international lines
  const intl = linesTab.filter((r) => r.is_visible).map((r) => Number(r.poverty_line)).sort((a, b) => a - b);
  const official = dcfg.fetch.international_lines;
  for (const l of official) if (!intl.includes(l)) throw new Error(`pip: line ${l} is not in PIP's poverty_lines table (${intl.join(", ")}): the official lines changed, update sources.yml`);
  const ladder = [...new Set([...official, ...dcfg.fetch.ladder])].sort((a, b) => a - b);

  const raw = { vintage: "", release: release.version, note: "PIP API rows for country=IND, year=all, one call per poverty line (survey years), plus the lineup (fill_gaps=true) at the international lines, PIP's poverty_lines and survey_means tables. As served.", poverty_lines: linesTab, survey: {}, lineup: {}, survey_means: null };
  for (const l of ladder) raw.survey[lineKey(l)] = await pip("pip", { country: "IND", year: "all", povline: l });
  for (const l of official) raw.lineup[lineKey(l)] = await pip("pip", { country: "IND", year: "all", povline: l, fill_gaps: "true" });
  raw.survey_means = (await pip("aux", { table: "survey_means" })).filter((r) => r.country_code === "IND");
  raw.vintage = `${release.release_version.slice(0, 4)}-${release.release_version.slice(4, 6)}-${release.release_version.slice(6, 8)}`;

  const base = raw.survey[lineKey(official[0])].filter((r) => r.reporting_level === "national");
  // anchor: India's surveys must be there, and the latest must be recent
  if (base.length < 8 || Math.max(...base.map((r) => r.reporting_year)) < 2022) throw new Error(`pip: India served ${base.length} surveys, latest ${Math.max(...base.map((r) => r.reporting_year))}: anchor assertion failed`);
  if (raw.survey_means.length !== base.length) throw new Error(`pip: survey_means lists ${raw.survey_means.length} India surveys, pip lists ${base.length}`);
  writeRaw(root, "data/raw/poverty-pip.json", raw);

  // ---- survey bundles, one per comparable spell ----
  const spells = [...new Set(base.map((r) => r.comparable_spell))];
  const meta0 = { dossier: "poverty", product: "pip", source: dcfg.source_agency, vintage: raw.vintage, mock: false, geo: dcfg.geo ?? "IND", releaseDate: raw.vintage, revisionPolicy: dcfg.revision_policy };
  const bundles = {};
  for (const spell of spells) {
    const rows = base.filter((r) => r.comparable_spell === spell).sort((a, b) => a.reporting_year - b.reporting_year);
    const years = rows.map((r) => r.reporting_year);
    const dates = years.map((y) => `${y}-01-01`);
    const sm = (y) => raw.survey_means.find((s) => s.reporting_year === y);
    const series = {};
    const at = (line, y, f) => raw.survey[lineKey(line)].find((r) => r.reporting_level === "national" && r.reporting_year === y)?.[f];
    for (const l of official) {
      for (const [f, lab] of Object.entries(LINE_FIELDS)) {
        series[`${f}_${lineKey(l)}`] = { name: `${f}_${l.toFixed(2)}`, label: `${lab} $${l.toFixed(2)} a day (2021 PPP), per cent`, unit: f === "watts" ? "index" : "pct", color: "#878D99", data: years.map((y) => (f === "watts" ? at(l, y, f) : pct(at(l, y, f)))) };
      }
      series[`poor_${lineKey(l)}`] = { name: `poor_millions_${l.toFixed(2)}`, label: `People below $${l.toFixed(2)} a day, millions (derived: headcount x population)`, unit: "million_persons", color: "#878D99",
        data: years.map((y) => Math.round(at(l, y, "headcount") * at(l, y, "reporting_pop") / 1e4) / 100) };
    }
    for (const l of ladder) if (!official.includes(l)) {
      series[`headcount_${lineKey(l)}`] = { name: `headcount_${l.toFixed(2)}`, label: `Share of people below $${l.toFixed(2)} a day (2021 PPP), per cent`, unit: "pct", color: "#878D99", data: years.map((y) => pct(at(l, y, "headcount"))) };
    }
    for (const [f, [lab, unit, isPct]] of Object.entries(FREE_FIELDS)) {
      series[f] = { name: f, label: lab + (isPct && unit === "pct" ? ", per cent" : ""), unit, color: "#878D99", data: years.map((y) => { const v = at(official[0], y, f); return v == null ? null : isPct ? pct(v) : v; }) };
    }
    series.survey_mean_lcu = { name: "survey_mean_lcu", label: "Mean consumption per person a day, rupees at survey prices", unit: "inr_day", color: "#878D99", data: years.map((y) => sm(y)?.survey_mean_lcu ?? null) };
    for (const s of Object.values(series)) if (s.data.every((v) => v == null)) throw new Error(`pip: ${spell} ${s.name} is empty`);
    const slug = `poverty-pip-${years[0]}`;
    bundles[slug] = {
      meta: { ...meta0, frequency: "irregular", base: `2021 PPP, comparable spell ${spell.replace(/\s+/g, "")}`,
        latestPeriod: String(years.at(-1)), spell, surveys: rows.map((r) => ({ year: r.reporting_year, survey: r.survey_acronym, period: sm(r.reporting_year)?.survey_time ?? null, welfare: r.welfare_type, distribution: r.distribution_type })),
        coverage: `PIP surveys in the comparable spell ${spell.replace(" - ", " to ")}: ${rows.map((r) => `${r.survey_acronym} ${sm(r.reporting_year)?.survey_time ?? r.reporting_year}`).join(", ")}`,
        note: "Each date is a survey's reporting year (the survey's own period is in meta.surveys). Shares are per cent of people; money is 2021 PPP dollars a day per person. Poor counts are derived (headcount times population). Never join this spell to another." },
      dates, series,
    };
  }

  // ---- the lineup: World Bank model estimates for every year ----
  {
    const L0 = raw.lineup[lineKey(official[0])].filter((r) => r.reporting_level === "national").sort((a, b) => a.reporting_year - b.reporting_year);
    const years = L0.map((r) => r.reporting_year);
    for (let i = 1; i < years.length; i++) if (years[i] !== years[i - 1] + 1) throw new Error(`pip: lineup skips from ${years[i - 1]} to ${years[i]}`);
    const dates = years.map((y) => `${y}-01-01`);
    const series = {};
    const row = (l, y) => raw.lineup[lineKey(l)].find((r) => r.reporting_level === "national" && r.reporting_year === y);
    // interpolations (inside the survey record) and extrapolations (nowcasts past
    // the last survey) are kept apart, so a chart can never draw one as the other
    for (const l of official) {
      const k = lineKey(l);
      series[`headcount_${k}`] = { name: `lineup_headcount_${l.toFixed(2)}`, label: `Share below $${l.toFixed(2)} a day, World Bank estimate between surveys, per cent`, unit: "pct", color: "#878D99",
        data: years.map((y) => (row(l, y).estimation_type !== "extrapolation" ? pct(row(l, y).headcount) : null)) };
      series[`headcount_${k}_nowcast`] = { name: `lineup_headcount_${l.toFixed(2)}_nowcast`, label: `Share below $${l.toFixed(2)} a day, World Bank nowcast after the last survey, per cent`, unit: "pct", color: "#878D99",
        data: years.map((y) => (row(l, y).estimation_type === "extrapolation" ? pct(row(l, y).headcount) : null)) };
      series[`poor_${k}`] = { name: `lineup_poor_millions_${l.toFixed(2)}`, label: `People below $${l.toFixed(2)} a day, millions, World Bank estimate (derived: headcount x population)`, unit: "million_persons", color: "#878D99",
        data: years.map((y) => Math.round(row(l, y).headcount * row(l, y).reporting_pop / 1e4) / 100) };
    }
    series.mean = { name: "lineup_mean", label: "Mean consumption per person a day, 2021 PPP $, World Bank estimate", unit: "ppp_usd_day", color: "#878D99", data: years.map((y) => row(official[0], y).mean) };
    const lastSurvey = Math.max(...base.map((r) => r.reporting_year));
    bundles["poverty-pip-lineup"] = {
      meta: { ...meta0, frequency: "annual", base: "2021 PPP, World Bank lineup estimates", latestPeriod: String(years.at(-1)), lastSurveyYear: lastSurvey,
        estimationType: Object.fromEntries(L0.map((r) => [r.reporting_year, `${r.estimation_type}${r.estimate_type ? ", " + r.estimate_type : ""}`])),
        coverage: "World Bank lineup estimates for India, every calendar year: interpolated between surveys, extrapolated (nowcast) after the last",
        note: `Every value is a World Bank model estimate, not a survey reading, including in survey years (the lineup aligns survey periods to calendar years). It bridges surveys that PIP itself marks as not comparable. Values after ${lastSurvey} are nowcasts, kept in separate *_nowcast series.` },
      dates, series,
    };
    // a release with no nowcast years leaves those series empty: drop them rather than bake an empty series
    const ls = bundles["poverty-pip-lineup"].series;
    for (const k of Object.keys(ls)) if (ls[k].data.every((v) => v == null)) delete ls[k];
  }

  // ---- coverage catalogue: what PIP publishes for India ----
  const items = [];
  const spellId = (s) => s.replace(/\s+/g, "").replace("-", "_");
  for (const spell of spells) {
    const sid = spellId(spell);
    for (const l of official) for (const f of Object.keys(LINE_FIELDS)) items.push({ id: `pip:survey:${sid}:${f}:${lineKey(l)}`, label: `${LINE_FIELDS[f]} $${l.toFixed(2)}, surveys ${spell}`, dims: { spell, line: l, level: "national" } });
    for (const f of Object.keys(FREE_FIELDS)) items.push({ id: `pip:survey:${sid}:${f}`, label: `${FREE_FIELDS[f][0]}, surveys ${spell}`, dims: { spell, level: "national" } });
    items.push({ id: `pip:survey:${sid}:survey_mean_lcu`, label: `Survey mean in rupees, surveys ${spell}`, dims: { spell } });
  }
  for (const l of official) items.push({ id: `pip:lineup:headcount:${lineKey(l)}`, label: `Lineup headcount at $${l.toFixed(2)}, every year`, dims: { line: l } });
  items.push({ id: "pip:lineup:distribution", label: "Lineup mean, median, Gini and deciles, every year", dims: {} });
  const levels = [...new Set(Object.values(raw.survey).flat().map((r) => r.reporting_level))];
  for (const lv of ["rural", "urban"]) if (!levels.includes(lv)) items.push({ id: `pip:level:${lv}`, label: `${lv[0].toUpperCase() + lv.slice(1)} estimates`, dims: { served: false } });
  for (const t of dcfg.fetch.aux_tables_not_used) items.push({ id: `pip:aux:${t}`, label: `PIP auxiliary table: ${t}`, dims: {} });
  writeJson(root, "data/coverage/poverty.catalogue.json", {
    family: "poverty", source: `World Bank, Poverty and Inequality Platform, release ${release.version}, country IND`,
    generator: "scripts/lib/products/pip.mjs via node scripts/fetch.mjs only poverty", generated_at: raw.vintage,
    note: "Every PIP measure for India, by comparable spell and international line, plus the lineup and the auxiliary tables. Rural and urban items are listed when PIP serves no such rows, so their absence is decided, not forgotten.",
    items,
  });

  for (const [slug, b] of Object.entries(bundles)) writeSeries(root, `data/series/${slug}.json`, b);
  return bundles;
}
