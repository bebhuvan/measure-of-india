// scripts/lib/products/wpp.mjs: India in the UN World Population Prospects
// (UN DESA Population Division), the primary source behind WDI's population
// series and the only official source of India's population projections.
//
// Files (2024 revision, CSV, gzip, all countries; India is LocID 356):
//   WPP2024_Demographic_Indicators_Medium.csv.gz        estimates 1950-2023 and
//                                                       the medium projection 2024-2100
//   WPP2024_Demographic_Indicators_OtherVariants.csv.gz 17 other projection variants
//                                                       (low, high, the probabilistic
//                                                       80% and 95% intervals, scenarios)
//   WPP2024_PopulationByAge5GroupSex_Medium.csv.gz      population by five-year age
//                                                       group and sex, 1 July
// About 120 MB together; they are kept in data/raw/http-cache (git-ignored) for
// WPP_CACHE_DAYS (default 30) so routine runs do not pull them again. WPP is
// revised every two years: a new revision is a new file name, set in sources.yml.
//
// Instruments. An estimate (1950 to the revision's last estimate year, 2023 for
// WPP 2024) and a projection are different things: the first reconstructs what
// happened, the second is a model of what may. They live in separate bundles and
// pages draw projections as projections:
//   population-wpp            estimates, 1950-2023
//   population-wpp-projection medium variant, 2024-2100
//   population-wpp-variants   every other variant, 2024-2100, one series per
//                             indicator and variant ("tpopulation1july__low")
//   population-wpp-age        population by age and sex, estimates (thousands),
//                             plus derived broad-age shares and dependency ratios
//   population-wpp-age-projection  the same, medium variant
// Values are stored as served (thousands of people, per 1,000, years), except the
// derived age shares and ratios, which are labelled with their formula.
//
// A defect in the published OtherVariants file: in the five probabilistic-interval
// variants, life expectancy at 15, 65 and 80 and the age-specific mortality columns
// carry impossible values (India and China alike, 2026-10-09). Those cells are not
// baked (sources.yml fetch.defects); the catalogue lists them, the ledger excludes them.
//
// Hand check (2026-10-09): India's 1 July 2024 population, WPP 2024 medium file,
// is 1,450,935.791 thousand, the figure WDI's SP.POP.TOTL carries for 2024
// (1,450,935,791). validate.mjs checks WDI against WPP every year.

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import zlib from "node:zlib";
import readline from "node:readline";
import { Readable } from "node:stream";
import { getBuffer } from "../net.mjs";
import { parseCsv } from "../tabular.mjs";
import { writeSeries, writeRaw, writeJson } from "../util.mjs";

const CACHE_DAYS = Number(process.env.WPP_CACHE_DAYS ?? 30);

async function fetchGz(root, url) {
  const dir = path.join(root, "data/raw/http-cache");
  const file = path.join(dir, "wpp-" + crypto.createHash("sha1").update(url).digest("hex") + ".gz");
  let buf;
  if (fs.existsSync(file) && Date.now() - fs.statSync(file).mtimeMs < CACHE_DAYS * 864e5) buf = fs.readFileSync(file);
  else {
    buf = await getBuffer(url, { maxBytes: 200 * 1024 * 1024 });
    if (buf[0] !== 0x1f || buf[1] !== 0x8b) throw new Error(`wpp: ${url} is not a gzip file`);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(file, buf);
  }
  return { buf, sha256: crypto.createHash("sha256").update(buf).digest("hex") };
}

// rows of one location, as objects. The files run to 230 MB unzipped, so they are
// streamed line by line and only lines carrying the location id are parsed.
async function rowsFor(buf, locId) {
  const rl = readline.createInterface({ input: Readable.from(buf).pipe(zlib.createGunzip()), crlfDelay: Infinity });
  let header = null, li = -1;
  const out = [];
  for await (const line of rl) {
    if (!header) { header = parseCsv(line.replace(/^\uFEFF/, ""), ",")[0]; li = header.indexOf("LocID"); continue; }
    if (!line.includes("," + locId + ",")) continue;
    const r = parseCsv(line, ",")[0];
    if (r[li] === String(locId)) out.push(Object.fromEntries(header.map((h, i) => [h, r[i] ?? ""])));
  }
  return { header, rows: out };
}

const ID_COLS = new Set(["SortOrder", "LocID", "Notes", "ISO3_code", "ISO2_code", "SDMX_code", "LocTypeID", "LocTypeName", "ParentID", "Location", "VarID", "Variant", "Time", "MidPeriod", "AgeGrp", "AgeGrpStart", "AgeGrpSpan"]);
const num = (s) => (s === "" || s == null ? null : Number(s));

// labels and units, from the WPP 2024 definitions (wpp/Download/Standard/CSV notes)
export const WPP_LABELS = {
  TPopulation1Jan: ["Total population, 1 January, thousands", "thousand"],
  TPopulation1July: ["Total population, 1 July, thousands", "thousand"],
  TPopulationMale1July: ["Male population, 1 July, thousands", "thousand"],
  TPopulationFemale1July: ["Female population, 1 July, thousands", "thousand"],
  PopDensity: ["Population density, persons per sq km, 1 July", "per_sq_km"],
  PopSexRatio: ["Sex ratio of the population, males per 100 females", "males_per_100_females"],
  MedianAgePop: ["Median age, years", "years"],
  NatChange: ["Natural change (births minus deaths), thousands", "thousand"],
  NatChangeRT: ["Rate of natural change, per 1,000 people", "per_1000"],
  PopChange: ["Population change, thousands", "thousand"],
  PopGrowthRate: ["Population growth rate, per cent", "pct"],
  DoublingTime: ["Population doubling time at the current growth rate, years (served only while the population grows)", "doubling_years"],
  Births: ["Births, thousands", "thousand"],
  Births1519: ["Births to women aged 15 to 19, thousands", "thousand"],
  CBR: ["Crude birth rate, births per 1,000 people", "per_1000"],
  TFR: ["Total fertility rate, live births per woman", "per_woman"],
  NRR: ["Net reproduction rate, surviving daughters per woman", "per_woman"],
  MAC: ["Mean age of mothers at childbearing, years", "years"],
  SRB: ["Sex ratio at birth, males per 100 females", "males_per_100_females"],
  Deaths: ["Deaths, thousands", "thousand"],
  DeathsMale: ["Male deaths, thousands", "thousand"],
  DeathsFemale: ["Female deaths, thousands", "thousand"],
  CDR: ["Crude death rate, deaths per 1,000 people", "per_1000"],
  LEx: ["Life expectancy at birth, both sexes, years", "years"],
  LExMale: ["Life expectancy at birth, males, years", "years"],
  LExFemale: ["Life expectancy at birth, females, years", "years"],
  LE15: ["Life expectancy at age 15, both sexes, years", "years"],
  LE15Male: ["Life expectancy at age 15, males, years", "years"],
  LE15Female: ["Life expectancy at age 15, females, years", "years"],
  LE65: ["Life expectancy at age 65, both sexes, years", "years"],
  LE65Male: ["Life expectancy at age 65, males, years", "years"],
  LE65Female: ["Life expectancy at age 65, females, years", "years"],
  LE80: ["Life expectancy at age 80, both sexes, years", "years"],
  LE80Male: ["Life expectancy at age 80, males, years", "years"],
  LE80Female: ["Life expectancy at age 80, females, years", "years"],
  InfantDeaths: ["Infant deaths (under age 1), thousands", "thousand"],
  IMR: ["Infant mortality rate, deaths per 1,000 live births", "per_1000"],
  LBsurvivingAge1: ["Live births surviving to age 1, thousands", "thousand"],
  Under5Deaths: ["Deaths under age 5, thousands", "thousand"],
  Q5: ["Under-five mortality, deaths per 1,000 live births", "per_1000"],
  Q0040: ["Mortality before age 40, per 1,000 live births, both sexes", "per_1000"],
  Q0040Male: ["Mortality before age 40, per 1,000 male live births", "per_1000"],
  Q0040Female: ["Mortality before age 40, per 1,000 female live births", "per_1000"],
  Q0060: ["Mortality before age 60, per 1,000 live births, both sexes", "per_1000"],
  Q0060Male: ["Mortality before age 60, per 1,000 male live births", "per_1000"],
  Q0060Female: ["Mortality before age 60, per 1,000 female live births", "per_1000"],
  Q1550: ["Mortality between ages 15 and 50, per 1,000 alive at 15, both sexes", "per_1000"],
  Q1550Male: ["Mortality between ages 15 and 50, per 1,000 males alive at 15", "per_1000"],
  Q1550Female: ["Mortality between ages 15 and 50, per 1,000 females alive at 15", "per_1000"],
  Q1560: ["Mortality between ages 15 and 60, per 1,000 alive at 15, both sexes", "per_1000"],
  Q1560Male: ["Mortality between ages 15 and 60, per 1,000 males alive at 15", "per_1000"],
  Q1560Female: ["Mortality between ages 15 and 60, per 1,000 females alive at 15", "per_1000"],
  NetMigrations: ["Net migration (immigrants minus emigrants), thousands", "thousand"],
  CNMR: ["Net migration rate, per 1,000 people", "per_1000"],
};
const keyOf = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");

function annualBundle(rows, cols, y0, y1, meta, labelSuffix = "") {
  const years = []; for (let y = y0; y <= y1; y++) years.push(y);
  const by = new Map(rows.map((r) => [Number(r.Time), r]));
  const dates = years.map((y) => `${y}-01-01`);
  const series = {};
  for (const c of cols) {
    const data = years.map((y) => num(by.get(y)?.[c]));
    if (data.every((v) => v == null)) continue;
    const [label, unit] = WPP_LABELS[c] ?? (() => { throw new Error(`wpp: no label for column ${c}`); })();
    const first = data.findIndex((v) => v != null), last = data.length - 1 - [...data].reverse().findIndex((v) => v != null);
    const gaps = dates.filter((d, i) => i > first && i < last && data[i] == null);
    series[keyOf(c)] = { name: c, label: label + labelSuffix, unit, color: "#878D99", data, ...(gaps.length ? { gaps, gapsNote: "WPP serves no value for this year." } : {}) };
  }
  // the total in the units a reader uses (derived, labelled): prose cites these, not thousands
  const tp = series.tpopulation1july?.data;
  if (tp) {
    series.population_billion = { name: "population_billion", label: "Total population, 1 July, billion (derived: thousands / 1,000,000)", unit: "billion", color: "#878D99", data: tp.map((v) => (v == null ? null : Math.round(v / 1e2) / 1e4)) };
    series.population_crore = { name: "population_crore", label: "Total population, 1 July, crore (derived: thousands / 10,000)", unit: "crore", color: "#878D99", data: tp.map((v) => (v == null ? null : Math.round(v / 1e2) / 1e2)) };
  }
  return { meta, dates, series };
}

const AGE_ORDER = (g) => Number(g.replace("+", "").split("-")[0]);
function ageBundle(rows, y0, y1, meta) {
  const years = []; for (let y = y0; y <= y1; y++) years.push(y);
  const dates = years.map((y) => `${y}-01-01`);
  const groups = [...new Set(rows.map((r) => r.AgeGrp))].sort((a, b) => AGE_ORDER(a) - AGE_ORDER(b));
  const cell = new Map(rows.map((r) => [`${r.Time}|${r.AgeGrp}`, r]));
  const series = {};
  for (const g of groups) for (const [col, sex] of [["PopTotal", "total"], ["PopMale", "male"], ["PopFemale", "female"]]) {
    const data = years.map((y) => num(cell.get(`${y}|${g}`)?.[col]));
    if (data.some((v) => v == null)) throw new Error(`wpp: age group ${g} ${sex} has a missing year`);
    series[`age_${keyOf(g)}_${sex}`] = { name: `${col}_${g}`, label: `Population aged ${g.replace("+", " and over")}, ${sex === "total" ? "both sexes" : sex + "s"}, thousands`, unit: "thousand", color: "#878D99", data };
  }
  // derived broad groups: shares of the total and dependency ratios (labelled)
  const sum = (y, pred) => groups.filter((g) => pred(AGE_ORDER(g))).reduce((s, g) => s + num(cell.get(`${y}|${g}`).PopTotal), 0);
  const tot = (y) => sum(y, () => true), young = (y) => sum(y, (a) => a < 15), work = (y) => sum(y, (a) => a >= 15 && a < 65), old = (y) => sum(y, (a) => a >= 65);
  const r4 = (v) => Math.round(v * 1e4) / 1e4;
  const derived = {
    share_0_14: ["Share of the population aged 0 to 14, per cent (derived: sum of age groups / total)", (y) => (100 * young(y)) / tot(y)],
    share_15_64: ["Share of the population aged 15 to 64 (working age), per cent (derived)", (y) => (100 * work(y)) / tot(y)],
    share_65_plus: ["Share of the population aged 65 and over, per cent (derived)", (y) => (100 * old(y)) / tot(y)],
    dependency_total: ["Dependency ratio: people aged 0-14 and 65+ per 100 aged 15-64 (derived)", (y) => (100 * (young(y) + old(y))) / work(y)],
    dependency_young: ["Young-age dependency ratio: aged 0-14 per 100 aged 15-64 (derived)", (y) => (100 * young(y)) / work(y)],
    dependency_old: ["Old-age dependency ratio: aged 65+ per 100 aged 15-64 (derived)", (y) => (100 * old(y)) / work(y)],
    working_age: ["Population aged 15 to 64, thousands (derived: sum of age groups)", (y) => work(y)],
  };
  for (const [k, [label, f]] of Object.entries(derived)) series[k] = { name: k, label, unit: k === "working_age" ? "thousand" : k.startsWith("share") ? "pct" : "per_100", color: "#878D99", data: years.map((y) => r4(f(y))) };
  return { meta: { ...meta, ageGroups: groups }, dates, series };
}

export async function buildWpp(root, dcfg) {
  const F = dcfg.fetch, loc = F.loc_id, lastEst = F.estimates_end;
  const got = {};
  for (const [k, file] of Object.entries(F.files)) {
    const { buf, sha256 } = await fetchGz(root, F.base_url + encodeURIComponent(file));
    got[k] = { ...(await rowsFor(buf, loc)), sha256, file };
    if (!got[k].rows.length) throw new Error(`wpp: ${file} holds no rows for LocID ${loc}: anchor assertion failed`);
  }
  const med = got.medium.rows.filter((r) => r.Variant === "Medium");
  const pop24 = num(med.find((r) => r.Time === String(lastEst + 1))?.TPopulation1July);
  if (!(pop24 > 1.3e6 && pop24 < 1.7e6)) throw new Error(`wpp: India ${lastEst + 1} population ${pop24} thousand implausible: anchor assertion failed`);

  // raw: India's rows as served (identifier columns dropped except Variant/Time/AgeGrp)
  const slim = (rows, keep) => rows.map((r) => Object.fromEntries(Object.entries(r).filter(([k, v]) => v !== "" && (!ID_COLS.has(k) || keep.includes(k)))));
  const raw = {
    vintage: F.vintage, revision: F.revision, location: `${got.medium.rows[0].Location} (LocID ${loc})`,
    note: "UN World Population Prospects, India's rows from the three standard CSV files, as served (empty cells dropped). Population in thousands.",
    files: Object.fromEntries(Object.entries(got).map(([k, g]) => [k, { file: g.file, sha256: g.sha256 }])),
    medium: slim(got.medium.rows, ["Variant", "Time"]),
    variants: slim(got.variants.rows, ["Variant", "Time"]),
    age: got.age.rows.map((r) => [Number(r.Time), r.AgeGrp, num(r.PopMale), num(r.PopFemale), num(r.PopTotal)]),
  };
  writeRaw(root, "data/raw/population-wpp.json", raw);

  const cols = got.medium.header.filter((h) => !ID_COLS.has(h));
  const lastProj = Math.max(...med.filter((r) => r.TPopulation1July !== "").map((r) => Number(r.Time)));
  const meta0 = { dossier: "population", product: "wpp", source: dcfg.source_agency, vintage: F.vintage, mock: false, geo: dcfg.geo ?? "IND", releaseDate: F.vintage, revisionPolicy: dcfg.revision_policy, base: dcfg.base, frequency: "annual" };
  const bundles = {};
  bundles["population-wpp"] = annualBundle(med, cols, 1950, lastEst, { ...meta0, kind: "estimate", latestPeriod: String(lastEst),
    coverage: `UN WPP ${F.revision} estimates for India, 1950 to ${lastEst}: population, births, deaths, fertility, mortality, life expectancy, migration`,
    note: `Estimates: the UN's reconstruction of each year from censuses, surveys and registration. Mid-year (1 July) unless the label says 1 January. The 1 January ${lastProj + 1} closing stock in the file is not baked.` });
  bundles["population-wpp-projection"] = annualBundle(med.filter((r) => Number(r.Time) > lastEst && Number(r.Time) <= lastProj), cols, lastEst + 1, lastProj, { ...meta0, kind: "projection", variant: "Medium", latestPeriod: String(lastProj),
    coverage: `UN WPP ${F.revision} medium-variant projection for India, ${lastEst + 1} to ${lastProj}`,
    note: "A projection, not data: the UN's medium variant, the median of its probabilistic projections of fertility and mortality, with its assumption for migration. Draw it as a projection." });
  {
    const vrows = got.variants.rows.filter((r) => Number(r.Time) <= lastProj);
    const variants = [...new Set(vrows.map((r) => r.Variant))];
    const years = []; for (let y = lastEst + 1; y <= lastProj; y++) years.push(y);
    const series = {}, defective = [];
    for (const v of variants) {
      const by = new Map(vrows.filter((r) => r.Variant === v).map((r) => [Number(r.Time), r]));
      for (const c of cols) {
        const data = years.map((y) => num(by.get(y)?.[c]));
        if (data.every((x) => x == null)) continue;
        if (F.defects.variants.includes(v) && F.defects.columns.includes(c)) { defective.push(`${keyOf(c)}__${keyOf(v)}`); continue; }
        const [label, unit] = WPP_LABELS[c];
        series[`${keyOf(c)}__${keyOf(v)}`] = { name: `${c} (${v})`, label: `${label}, ${v} variant`, unit, color: "#878D99", data };
      }
    }
    bundles["population-wpp-variants"] = { meta: { ...meta0, kind: "projection", variants, latestPeriod: String(lastProj),
      coverage: `UN WPP ${F.revision} projection variants for India, ${lastEst + 1} to ${lastProj}: ${variants.join(", ")}`,
      note: "Projections, not data. Low and High move fertility half a child below and above the medium; the PI variants are the probabilistic 80% and 95% intervals; the rest are scenarios (constant fertility, zero migration and so on). Series key: <indicator>__<variant>." },
      dates: years.map((y) => `${y}-01-01`), series };
    bundles["population-wpp-variants"].meta.defectiveNotBaked = defective;
  }
  const age = got.age.rows;
  bundles["population-wpp-age"] = ageBundle(age.filter((r) => Number(r.Time) <= lastEst), 1950, lastEst, { ...meta0, kind: "estimate", latestPeriod: String(lastEst),
    coverage: `UN WPP ${F.revision} population of India by five-year age group and sex, 1 July, 1950 to ${lastEst}, with broad-age shares and dependency ratios`,
    note: "Estimates, thousands of people. Broad-age shares and dependency ratios are derived here from the age groups and labelled so." });
  bundles["population-wpp-age-projection"] = ageBundle(age.filter((r) => Number(r.Time) > lastEst && Number(r.Time) <= lastProj), lastEst + 1, lastProj, { ...meta0, kind: "projection", variant: "Medium", latestPeriod: String(lastProj),
    coverage: `UN WPP ${F.revision} medium-variant projection of India's population by age and sex, ${lastEst + 1} to ${lastProj}`,
    note: "A projection, not data (medium variant). Thousands of people. Broad-age shares and dependency ratios derived and labelled." });

  // coverage catalogue: every WPP indicator x instrument, every age group x sex
  const items = [];
  for (const c of cols) {
    if (med.some((r) => Number(r.Time) <= lastEst && r[c] !== "")) items.push({ id: `wpp:estimate:${keyOf(c)}`, label: `${WPP_LABELS[c][0]}, estimates`, dims: { kind: "estimate" } });
    if (med.some((r) => Number(r.Time) > lastEst && r[c] !== "")) items.push({ id: `wpp:projection:medium:${keyOf(c)}`, label: `${WPP_LABELS[c][0]}, medium projection`, dims: { kind: "projection", variant: "Medium" } });
  }
  for (const s of [...Object.keys(bundles["population-wpp-variants"].series), ...bundles["population-wpp-variants"].meta.defectiveNotBaked]) { const [c, v] = s.split("__"); items.push({ id: `wpp:projection:${v}:${c}`, label: `${s} (WPP ${F.revision} other variants)`, dims: { kind: "projection", variant: v } }); }
  for (const g of bundles["population-wpp-age"].meta.ageGroups) for (const sex of ["total", "male", "female"]) {
    items.push({ id: `wpp:age:estimate:${keyOf(g)}:${sex}`, label: `Population aged ${g}, ${sex}, estimates`, dims: { kind: "estimate", age: g, sex } });
    items.push({ id: `wpp:age:projection:${keyOf(g)}:${sex}`, label: `Population aged ${g}, ${sex}, medium projection`, dims: { kind: "projection", age: g, sex } });
  }
  items.push({ id: "wpp:closing_stock:tpopulation1jan_2101", label: `Population on 1 January ${lastProj + 1}`, dims: {} });
  writeJson(root, "data/coverage/population.catalogue.json", {
    family: "population", source: `UN DESA Population Division, World Population Prospects ${F.revision}, India (LocID ${loc}), standard CSV files`,
    generator: "scripts/lib/products/wpp.mjs via node scripts/fetch.mjs only population", generated_at: F.vintage,
    note: "Every WPP indicator for India in the three standard CSV files, by instrument (estimate, medium projection, each other variant), and every age group by sex. WDI's population series are in the worldbank catalogue.",
    items,
  });

  for (const [slug, b] of Object.entries(bundles)) writeSeries(root, `data/series/${slug}.json`, b);
  return bundles;
}
