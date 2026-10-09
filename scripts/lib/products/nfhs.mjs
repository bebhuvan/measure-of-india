// scripts/lib/products/nfhs.mjs — National Family Health Survey (NFHS).
//
// 21 indicators covering the full health landscape: child mortality &
// nutrition, anaemia, maternal care, adult NCDs, fertility, women's
// empowerment, gender violence, tobacco/alcohol. Two survey rounds served:
// NFHS-4 (2015-16) and NFHS-5 (2019-21). Each indicator carries sub_indicator
// × sector × survey dimensions. The fetcher ingests all 21 indicators to raw
// and bakes 7 thematic bundles, each carrying every All-India Combined
// sub-indicator with both survey values on a 2-point date axis (2016, 2020).
//
// KEY FINDING: anaemia WORSENED between rounds (child 58→67%, women 53→57%)
// while most other health indicators improved. The dossier makes this
// counterintuitive reversal its central story.
//
// Bundles baked:
//   nfhs-child.json      — child mortality (IMR, U5MR), nutrition (stunting,
//                          wasting, underweight), feeding, vaccination
//   nfhs-maternal.json   — institutional births, skilled attendance, ANC,
//                          IFA, C-section (overall + public + private)
//   nfhs-anaemia.json    — anaemia by demographic (children, women, men)
//   nfhs-adult.json      — BMI (thin + overweight), blood sugar, BP,
//                          tobacco, alcohol — by gender
//   nfhs-fertility.json  — TFR, child marriage, contraception, women's
//                          empowerment (bank, mobile, property, violence)
//   nfhs-household.json  — sanitation, electricity, water, clean fuel, health insurance
//   nfhs-states.json     — state-wise NFHS-5 for key indicators (child
//                          anaemia, stunting, IMR, institutional births)

import { mospi } from "../mospi.mjs";
import { writeSeries, writeRaw } from "../util.mjs";

const GREYS = ["#5F6675", "#878D99", "#A3A9B4", "#C9CED6"];
const val = (r) => {
  const v = parseFloat(r.value);
  return Number.isFinite(v) ? v : null;
};
const slugify = (s) => String(s).trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 60);

async function fetchAll(code) {
  const rows = [];
  let page = 1;
  for (;;) {
    const res = await mospi("nfhs/getNfhsRecords", { indicator_code: code, page, limit: 500 });
    rows.push(...(res.data ?? []));
    const tp = res.meta_data?.totalPages ?? 1;
    if (page >= tp) break;
    page++;
  }
  return rows;
}

export async function buildNfhs(root, dcfg, vintage) {
  const byInd = {};
  for (const code of Object.keys(dcfg.fetch.indicators)) byInd[code] = await fetchAll(code);
  writeRaw(root, "data/raw/nfhs-records.json", {
    vintage,
    note: "Complete row-sets of all 21 NFHS indicators from nfhs/getNfhsRecords, both survey rounds (NFHS-4 & NFHS-5). Each row keys on (state, sub_indicator, sector, survey, value).",
    indicators: byInd,
  });

  const dates = ["2016-01-01", "2020-01-01"]; // NFHS-4 & NFHS-5 midpoints
  const metaBase = {
    dossier: "nfhs", frequency: "cross-sectional", base: dcfg.base,
    source: dcfg.source_agency, vintage, mock: false,
    geo: dcfg.geo ?? "IND",
    latestPeriod: "2019-21", releaseDate: null,
    revisionPolicy: dcfg.revision_policy,
  };
  const note = "Two survey rounds: NFHS-4 (2015-16) and NFHS-5 (2019-21). Each sub-indicator is a cross-sectional estimate, never chained. Some sub-indicators are new in NFHS-5 and carry a null NFHS-4 value. Sector = Rural + Urban (Combined) throughout.";

  // build a series entry for a sub-indicator from All India Combined rows
  const buildSeries = (rows, label, accent) => {
    const ai = rows.filter((r) => r.state === "All India" && r.sector === "Rural + Urban (Combined)");
    const n4 = ai.find((r) => r.survey === "nfhs-4");
    const n5 = ai.find((r) => r.survey === "nfhs-5");
    const v4 = n4 ? val(n4) : null;
    const v5 = n5 ? val(n5) : null;
    if (v4 == null && v5 == null) return null;
    const key = slugify(label);
    return {
      key,
      s: {
        name: `nfhs_${key}`, label: label.replace(/\d+$/g, "").trim(),
        color: accent ?? GREYS[0],
        data: [v4, v5], unit: "percent",
      },
    };
  };

  // bake a thematic bundle from a set of indicator codes
  const bakeTheme = (themeName, indicatorCodes) => {
    const series = {};
    let ci = 0;
    for (const code of indicatorCodes) {
      const rows = byInd[code];
      if (!rows?.length) continue;
      const aiRows = rows.filter((r) => r.state === "All India" && r.sector === "Rural + Urban (Combined)");
      const subs = [...new Set(aiRows.map((r) => r.sub_indicator))];
      for (const sub of subs) {
        const subRows = aiRows.filter((r) => r.sub_indicator === sub);
        const entry = buildSeries(subRows, sub);
        if (!entry) continue;
        // avoid key collisions across indicators
        const fullKey = `i${code}_${entry.key}`;
        series[fullKey] = { ...entry.s, name: `nfhs_${fullKey}`, color: GREYS[ci++ % GREYS.length] };
      }
    }
    return { meta: { ...metaBase, coverage: `All India, Rural + Urban (Combined); ${themeName}; NFHS-4 (2015-16) and NFHS-5 (2019-21)`, note }, dates, series };
  };

  const themes = dcfg.fetch.themes;
  const bundles = {};
  for (const [name, codes] of Object.entries(themes)) {
    bundles[name] = bakeTheme(name, codes);
  }

  // helper to find a series by partial label match within a bundle
  // (used by validate and available to the client)
  for (const b of Object.values(bundles)) {
    b.find = (needle) => {
      const lower = needle.toLowerCase();
      const found = Object.values(b.series).find((s) => s.label.toLowerCase().includes(lower));
      return found ?? null;
    };
  }

  /* ---- nfhs-states.json — state-wise key indicators, NFHS-5 ---- */
  const STATE_KEYS = [
    ["i14_child_anaemia", 14, "Children age 6-59 months"],
    ["i12_stunting", 12, "stunted"],
    ["i9_institutional", 9, "Institutional births (in the 5 years"],
    ["i4_imr", 4, "Infant mortality rate"],
  ];
  const stSeries = {};
  let si = 0;
  for (const [key, code, subMatch] of STATE_KEYS) {
    const rows = (byInd[code] || []).filter((r) => r.state !== "All India" && r.sector === "Rural + Urban (Combined)" && r.survey === "nfhs-5" && r.sub_indicator.includes(subMatch));
    for (const r of rows) {
      const v = val(r);
      if (v == null) continue;
      const sk = `${key}__${slugify(r.state)}`;
      stSeries[sk] = {
        name: `nfhs_state_${sk}`, label: `${key.split("_").slice(1).join(" ")} · ${r.state}`,
        color: GREYS[si++ % GREYS.length], data: [v], unit: "percent",
      };
    }
  }
  // states bundle uses a single-point date axis
  bundles.states = {
    meta: { ...metaBase, coverage: "States/UTs; key child and maternal indicators, NFHS-5 (2019-21), Rural + Urban (Combined)", note },
    dates: ["2020-01-01"], series: stSeries,
  };

  // sanity: at least the anaemia bundle should have data
  if (Object.keys(bundles.anaemia.series).length === 0) throw new Error("NFHS: anaemia bundle empty");

  for (const [name, b] of Object.entries(bundles)) {
    writeSeries(root, `data/series/nfhs-${name}.json`, b);
  }
  return bundles.anaemia;
}

/* Catalogue (docs/CONTRACT-coverage.md): nfhs/getNfhsIndicatorList (21 tables) and
 * nfhs/getnfhsFilterByIndicatorId. Each table's sub-indicators are separate measures, and so
 * are the two rounds: both are crossed with every cut.
 *   nfhs:<table>:<sub-indicator>:<round>:all | :state:<state> | :sector:<sector> */
import { writeCatalogue, indicatorCatalogue, catalogueCli } from "../catalogue.mjs";
export async function catalogueNfhs() {
  const inds = (await mospi("nfhs/getNfhsIndicatorList", {})).data ?? [];
  const items = await indicatorCatalogue({ mospi, prefix: "nfhs", indicators: Array.isArray(inds) ? inds : inds.indicator ?? [],
    cross: ["sub_indicator", "survey"],
    filter: (ind) => ["nfhs/getnfhsFilterByIndicatorId", { indicator_code: ind.indicator_code }] });
  writeCatalogue("nfhs", { source: "MoSPI / IIPS: National Family Health Survey, NFHS-4 and NFHS-5 (eSankhyiki API)",
    generator: "scripts/lib/products/nfhs.mjs --catalogue",
    note: "From getNfhsIndicatorList and getnfhsFilterByIndicatorId: every sub-indicator and round, one cut at a time (state, or rural/urban).", items });
}
await catalogueCli(import.meta.url, catalogueNfhs);
