// scripts/lib/products/aishe.mjs — All India Survey on Higher Education.
//
// Nine indicators (aishe/getAisheIndicatorList), five survey years
// (2017-18 to 2021-22), ~17k rows in total — every indicator is ingested IN
// FULL (paged, limit=500, keyed by indicator_code only) and sliced
// client-side, the same approach as hces/rbi. Fiscal-year labels plot at
// April of the first year ("2021-22" -> 2021-04).
//
// SOURCE DEFECT — teachers (ind 9), 2021-22: the API's "All Teacher" total
// row is garbled for 2021-22 (All India = 12,904 against ~1.55M the year
// before; every state cell is a near-zero residual). The 2021-22 "Visiting
// Teacher" row carries the real total instead. The fetcher reconstructs the
// 2021-22 teachers figure as the sum of the five regular faculty types
// (Professor & Equivalent + Reader & Associate Professor +
// Lecturer/Assistant Professor + Demonstrator/Tutor + Temporary Teacher) —
// a sum that equals 99.0-99.2% of the published "All Teacher" total in
// every clean year. The reconstruction is disclosed in meta.note and the
// raw "All Teacher" 2021-22 value is preserved in the raw dump.
//
// Bundles baked:
//   aishe-headline.json      — All-India 5-year headline series:
//                              universities, colleges, enrolment (Grand
//                              Total, Both), teachers (reconstructed 2021-22),
//                              GER (All Categories, Both), GPI (All Categories),
//                              PTR (Regular and Distance, All Institutions)
//   aishe-access.json        — All-India GER by social category × gender +
//                              GPI by social category + enrolment by gender,
//                              all 5 years
//   aishe-composition.json   — All-India enrolment by education level (Both)
//                              + by social group (Both), all 5 years; the
//                              levels sum to the Grand Total, the three
//                              named groups plus a computed "Others" sum to it
//   aishe-states.json        — state-wise enrolment (Grand Total, Both),
//                              GER (All Categories, Both) and GPI (All
//                              Categories), all 5 years

import { mospi } from "../mospi.mjs";
import { writeSeries, writeRaw } from "../util.mjs";

const GREYS = ["#5F6675", "#878D99", "#A3A9B4", "#C9CED6"];
const slugify = (s) => String(s).trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
const fyStart = (fy) => `${String(fy).slice(0, 4)}-04`; // "2021-22" -> "2021-04"
const val = (r) => {
  const v = parseFloat(r.value);
  return Number.isFinite(v) ? v : null;
};
// source labels carry stray double spaces ("Scheduled  Caste"); normalise
const normSocial = (s) => ({ "scheduled caste": "sc", "scheduled tribe": "st", "other backward classes": "obc", "all categories": "all" })[String(s).trim().toLowerCase().replace(/\s+/g, " ")];

async function fetchAll(code) {
  const rows = [];
  let page = 1;
  for (;;) {
    const res = await mospi("aishe/getAisheRecords", { indicator_code: code, page, limit: 500 });
    rows.push(...(res.data ?? []));
    const tp = res.meta_data?.totalPages ?? 1;
    if (page >= tp) break;
    page++;
  }
  return rows;
}

export async function buildAishe(root, dcfg, vintage) {
  const byInd = {};
  for (const code of Object.keys(dcfg.fetch.indicators)) byInd[code] = await fetchAll(code);
  writeRaw(root, "data/raw/aishe-records.json", {
    vintage,
    note: "Complete row-sets of all 9 AISHE indicators from aishe/getAisheRecords, survey years 2017-18 to 2021-22. The 2021-22 'All Teacher' total row is a source defect (see fetcher header); its raw value is preserved here as served.",
    indicators: byInd,
  });

  // continuous fiscal-year axis over the five served survey years
  const allYears = [...new Set(Object.values(byInd).flat().map((r) => r.year))].sort();
  const axis = [];
  for (let y = Number(allYears[0].slice(0, 4)); y <= Number(allYears.at(-1).slice(0, 4)); y++) axis.push(`${y}-04`);
  const dates = axis.map((ym) => `${ym}-01`);
  const metaBase = {
    dossier: "aishe", frequency: "annual", base: dcfg.base,
    source: dcfg.source_agency, vintage, mock: false,
    geo: dcfg.geo ?? "IND",
    latestPeriod: axis.at(-1), releaseDate: null,
    revisionPolicy: dcfg.revision_policy,
  };

  // Map("YYYY-MM" -> value) over a filtered row-set
  const toMap = (rows) => {
    const m = new Map();
    for (const r of rows) {
      const v = val(r);
      if (v != null) m.set(fyStart(r.year), v);
    }
    return m;
  };
  const data = (m) => axis.map((ym) => m.get(ym) ?? null);
  const ai = (rows) => rows.filter((r) => r.state === "All India");

  /* =========================================================
   *  aishe-headline.json — the 5-year headline series
   * ========================================================= */
  const yrNote = "Survey years are fiscal (Apr–Mar), plotted at April of the first year. The five AISHE rounds served by the eSankhyiki API (2017-18 to 2021-22) are comparable by design but are never chained into a spliced index. GER (Gross Enrolment Ratio) = enrolled students ÷ the college-age population × 100; it is gross, so it can exceed 100. GPI (Gender Parity Index) = female GER ÷ male GER; 1.0 is parity.";

  // teachers — published "All Teacher" Both, reconstructed for the 2021-22
  // source defect from the sum of the five regular faculty types
  const CORE_FACULTY = ["Professor & Equivalent", "Reader & Associate Professor", "Lecturer/Assistant Professor", "Demonstrator/Tutor", "Temporary Teacher etc."];
  const tRows = ai(byInd["9"]);
  const teacherMap = new Map();
  for (const ym of axis) {
    const fy = `${ym.slice(0, 4)}-${String((+ym.slice(0, 4) + 1) % 100).padStart(2, "0")}`;
    const allT = tRows.find((r) => fyStart(r.year) === ym && r.faculty_type === "All Teacher" && r.gender === "Both");
    const published = allT ? val(allT) : null;
    // the defect prints a near-zero residual (~13k vs ~1.55M); reconstruct
    if (published != null && published > 100000) {
      teacherMap.set(ym, published);
    } else {
      const core = tRows.filter((r) => fyStart(r.year) === ym && r.gender === "Both" && CORE_FACULTY.includes(r.faculty_type)).reduce((a, r) => a + (val(r) ?? 0), 0);
      if (core > 0) teacherMap.set(ym, core);
    }
  }

  const enrolGT = (gender) => toMap(ai(byInd["3"]).filter((r) => r.education_level === "Grand Total" && String(r.gender).toLowerCase() === String(gender).toLowerCase()));
  const gerAll = (gender) => toMap(ai(byInd["6"]).filter((r) => normSocial(r.social_category) === "all" && r.gender === gender));
  const gpiAll = toMap(ai(byInd["7"]).filter((r) => normSocial(r.social_category) === "all"));
  const ptrAll = toMap(ai(byInd["8"]).filter((r) => r.learning_mode === "Regular and Distance" && r.institution_type === "All Institutions"));

  const headlineSeries = {
    universities: { name: "aishe_universities", label: "Universities", color: "#5F6675", data: data(toMap(ai(byInd["1"]))), unit: "count" },
    colleges: { name: "aishe_colleges", label: "Colleges", color: "#5F6675", data: data(toMap(ai(byInd["2"]))), unit: "count" },
    enrolment: { name: "aishe_enrolment_both", label: "Estimated student enrolment", color: "#2E4BD8", data: data(enrolGT("Both")), unit: "count" },
    teachers: { name: "aishe_teachers_all", label: "Teachers", color: "#5F6675", data: data(teacherMap), unit: "count" },
    ger: { name: "aishe_ger_all_both", label: "Gross Enrolment Ratio · All Categories", color: "#5F6675", data: data(gerAll("Both")), unit: "percent" },
    gpi: { name: "aishe_gpi_all", label: "Gender Parity Index · All Categories", color: "#5F6675", data: data(gpiAll), unit: "index" },
    ptr: { name: "aishe_ptr_all", label: "Pupil-Teacher Ratio · all institutions", color: "#5F6675", data: data(ptrAll), unit: "ratio" },
  };
  if (!headlineSeries.enrolment.data.some((v) => v != null)) throw new Error("AISHE: no enrolment data returned");
  const headlineBundle = {
    meta: {
      ...metaBase,
      coverage: "All India; universities, colleges, estimated student enrolment (Grand Total, Both), teachers, GER (All Categories, Both), GPI (All Categories), PTR (Regular and Distance, All Institutions)",
      note: yrNote + " TEACHERS (2021-22): the API's 'All Teacher' total row is a source defect for 2021-22 (All India = 12,904, a near-zero residual against ~1.55M the year before; the same year's 'Visiting Teacher' row carries the real total instead). The 2021-22 figure here is reconstructed as the sum of the five regular faculty types (Professor & Equivalent + Reader & Associate Professor + Lecturer/Assistant Professor + Demonstrator/Tutor + Temporary Teacher), which equals 99.0-99.2% of the published 'All Teacher' total in every clean year. Earlier years use the published 'All Teacher' total as served.",
    },
    dates, series: headlineSeries,
  };

  /* =========================================================
   *  aishe-access.json — GER/GPI by social category + enrolment by gender
   * ========================================================= */
  const accessSeries = {};
  let ai2 = 0;
  // GER by social category × gender (SC/ST/All served; no OBC)
  for (const sc of ["all", "sc", "st"]) {
    for (const g of ["both", "male", "female"]) {
      const rows = ai(byInd["6"]).filter((r) => normSocial(r.social_category) === sc && String(r.gender).toLowerCase() === g);
      if (!rows.length) continue;
      const key = `ger_${sc}_${g}`;
      accessSeries[key] = {
        name: `aishe_${key}`, label: `GER · ${sc === "all" ? "All Categories" : sc.toUpperCase()} · ${g}`,
        color: sc === "all" && g === "both" ? "#2E4BD8" : GREYS[ai2++ % GREYS.length],
        data: data(toMap(rows)), unit: "percent",
      };
    }
  }
  // GPI by social category (no gender dim — GPI is itself a gender ratio)
  for (const sc of ["all", "sc", "st"]) {
    const rows = ai(byInd["7"]).filter((r) => normSocial(r.social_category) === sc);
    if (!rows.length) continue;
    const key = `gpi_${sc}`;
    accessSeries[key] = {
      name: `aishe_${key}`, label: `GPI · ${sc === "all" ? "All Categories" : sc.toUpperCase()}`,
      color: sc === "all" ? "#2E4BD8" : GREYS[ai2++ % GREYS.length],
      data: data(toMap(rows)), unit: "index",
    };
  }
  // enrolment by gender (Grand Total) — the volume behind the ratios
  for (const g of ["male", "female"]) {
    const key = `enrolment_${g}`;
    accessSeries[key] = {
      name: `aishe_${key}`, label: `Enrolment · ${g}`,
      color: g === "female" ? "#2E4BD8" : "#5F6675",
      data: data(enrolGT(g)), unit: "count",
    };
  }
  const accessBundle = {
    meta: {
      ...metaBase,
      coverage: "All India; GER by social category × gender (SC, ST, All Categories — the API serves no OBC GER), GPI by social category, and enrolment by gender (Grand Total)",
      note: yrNote + " GER for SC and ST runs below the All-India ratio in every year; the gender gap within each group is what GPI measures. The AISHE API publishes GER only for SC, ST and All Categories — there is no OBC GER series to serve.",
    },
    dates, series: accessSeries,
  };

  /* =========================================================
   *  aishe-composition.json — enrolment by level + by social group
   * ========================================================= */
  const EDU_ORDER = [
    ["Ph.D.", "phd", "Ph.D."],
    ["M.Phil.", "mphil", "M.Phil."],
    ["Post Graduate", "post_graduate", "Post Graduate"],
    ["Under Graduate", "under_graduate", "Under Graduate"],
    ["PG Diploma", "pg_diploma", "PG Diploma"],
    ["Diploma", "diploma", "Diploma"],
    ["Certificate", "certificate", "Certificate"],
    ["Integrated", "integrated", "Integrated"],
  ];
  const compSeries = {};
  let ci = 0;
  for (const [, key, label] of EDU_ORDER) {
    const rows = ai(byInd["3"]).filter((r) => r.education_level === EDU_ORDER.find((e) => e[1] === key)[0] && r.gender === "Both");
    if (!rows.length) continue;
    compSeries[key] = {
      name: `aishe_enrolment_${key}`, label,
      color: key === "under_graduate" ? "#2E4BD8" : GREYS[ci++ % GREYS.length],
      data: data(toMap(rows)), unit: "count",
    };
  }
  // social group enrolment (Both): SC, ST, OBC + computed Others
  const SG = [["sc", "Scheduled Caste"], ["st", "Scheduled Tribe"], ["obc", "Other Backward Classes"]];
  const groupMaps = {};
  for (const [gk, label] of SG) {
    const m = toMap(ai(byInd["4"]).filter((r) => normSocial(r.social_category) === gk && r.gender === "Both"));
    groupMaps[gk] = m;
    compSeries[`social_${gk}`] = {
      name: `aishe_enrolment_social_${gk}`, label: `Enrolment · ${label}`,
      color: gk === "obc" ? "#2E4BD8" : GREYS[ci++ % GREYS.length],
      data: data(m), unit: "count",
    };
  }
  // Others = Grand Total − SC − ST − OBC (not served directly)
  const totalMap = enrolGT("Both");
  const othersMap = new Map();
  for (const ym of axis) {
    const t = totalMap.get(ym), sc = groupMaps.sc.get(ym), st = groupMaps.st.get(ym), obc = groupMaps.obc.get(ym);
    if (t != null && sc != null && st != null && obc != null) othersMap.set(ym, t - sc - st - obc);
  }
  compSeries.social_others = {
    name: "aishe_enrolment_social_others", label: "Enrolment · Others (residual)",
    color: GREYS[ci++ % GREYS.length], data: data(othersMap), unit: "count",
  };
  const compositionBundle = {
    meta: {
      ...metaBase,
      coverage: "All India; estimated student enrolment (Both) by education level and by social group, all five survey years. Education levels sum to the Grand Total; social groups SC + ST + OBC + Others (residual) sum to the Grand Total.",
      note: yrNote + " The eight education levels sum exactly to the Grand Total in every year (the identities are asserted in scripts/validate.mjs). 'Others' is a residual — the API serves enrolment for SC, ST and OBC but not a plain 'Others' category, so it is computed as Grand Total minus the three named groups.",
    },
    dates, series: compSeries,
  };

  /* =========================================================
   *  aishe-states.json — state-wise enrolment, GER, GPI
   * ========================================================= */
  const stSeries = {};
  let si = 0;
  // enrolment by state (Grand Total, Both)
  const stEnr = byInd["3"].filter((r) => r.state !== "All India" && r.education_level === "Grand Total" && r.gender === "Both");
  const stGer = byInd["6"].filter((r) => r.state !== "All India" && normSocial(r.social_category) === "all" && r.gender === "Both");
  const stGpi = byInd["7"].filter((r) => r.state !== "All India" && normSocial(r.social_category) === "all");
  const stateNames = [...new Set(stEnr.map((r) => r.state))].sort();
  for (const st of stateNames) {
    const sk = slugify(st);
    stSeries[`enrolment_${sk}`] = {
      name: `aishe_enrolment_${sk}`, label: `Enrolment · ${st}`,
      color: GREYS[si++ % GREYS.length], data: data(toMap(stEnr.filter((r) => r.state === st))), unit: "count",
    };
  }
  for (const st of [...new Set(stGer.map((r) => r.state))].sort()) {
    const sk = slugify(st);
    stSeries[`ger_${sk}`] = {
      name: `aishe_ger_${sk}`, label: `GER · ${st}`,
      color: GREYS[si++ % GREYS.length], data: data(toMap(stGer.filter((r) => r.state === st))), unit: "percent",
    };
  }
  for (const st of [...new Set(stGpi.map((r) => r.state))].sort()) {
    const sk = slugify(st);
    stSeries[`gpi_${sk}`] = {
      name: `aishe_gpi_${sk}`, label: `GPI · ${st}`,
      color: GREYS[si++ % GREYS.length], data: data(toMap(stGpi.filter((r) => r.state === st))), unit: "index",
    };
  }
  const statesBundle = {
    meta: {
      ...metaBase,
      coverage: "States/UTs; enrolment (Grand Total, Both), GER (All Categories, Both) and GPI (All Categories), all five survey years. Some UTs carry GER or GPI only in later years (small samples); interior nulls are disclosed in gaps.",
    },
    dates, series: stSeries,
  };

  /* =========================================================
   *  aishe-teachers.json — faculty hierarchy × gender (5 core types)
   * ========================================================= */
  // The "All Teacher" total and "Visiting Teacher" rows are BOTH defective
  // for 2021-22 (total garbled to ~13k; visiting carries the real total).
  // The five regular faculty types below are clean in every year.
  const FAC = [
    ["Professor & Equivalent", "professor", "Professor & Equivalent"],
    ["Reader & Associate Professor", "reader_associate", "Reader / Associate Prof."],
    ["Lecturer/Assistant Professor", "lecturer_assistant", "Lecturer / Asst. Prof."],
    ["Demonstrator/Tutor", "demonstrator", "Demonstrator / Tutor"],
    ["Temporary Teacher etc.", "temporary", "Temporary Teacher"],
  ];
  const tchSeries = {};
  let ti = 0;
  for (const [, fk, label] of FAC) {
    for (const g of ["both", "male", "female"]) {
      const rows = ai(byInd["9"]).filter((r) => r.faculty_type === FAC.find((f) => f[1] === fk)[0] && String(r.gender).toLowerCase() === g);
      if (!rows.length) continue;
      const key = `${fk}_${g}`;
      tchSeries[key] = {
        name: `aishe_teachers_${key}`, label: `${label} · ${g}`,
        color: fk === "lecturer_assistant" && g === "both" ? "#2E4BD8" : GREYS[ti++ % GREYS.length],
        data: data(toMap(rows)), unit: "count",
      };
    }
  }
  const teachersBundle = {
    meta: {
      ...metaBase,
      coverage: "All India; teachers by the five regular faculty types × gender (Both/Male/Female), all five survey years. The defective 'All Teacher' total and 'Visiting Teacher' rows are excluded — see the headline-bundle note for the 2021-22 defect.",
      note: yrNote + " The faculty hierarchy runs from Professor & Equivalent (the senior-most rank) down to Temporary Teacher. The five types summed equal 99.0–99.2% of the published 'All Teacher' total in every clean year (the remainder is visiting/guest faculty, excluded here because its 2021-22 row is the source defect).",
    },
    dates, series: tchSeries,
  };

  /* =========================================================
   *  aishe-minority.json — PWD & minority community enrolment (ind 5)
   * ========================================================= */
  // EWS (Economically Weaker Sections) is a category introduced after the
  // 2019 constitutional amendment; it carries no data before 2019-20 ("*"),
  // which the parser drops to null.
  const MIN = [
    ["Muslims", "muslims", "Muslims"],
    ["Other Minority Communities", "other_minority", "Other Minority Communities"],
    ["EWS", "ews", "Economically Weaker Sections"],
    ["Persons With Disability", "pwd", "Persons With Disability"],
  ];
  const minSeries = {};
  let mi = 0;
  for (const [, gk, label] of MIN) {
    for (const g of ["both", "male", "female"]) {
      const rows = ai(byInd["5"]).filter((r) => r.social_group === MIN.find((m) => m[1] === gk)[0] && String(r.gender).toLowerCase() === g);
      if (!rows.length) continue;
      const key = `${gk}_${g}`;
      minSeries[key] = {
        name: `aishe_minority_${key}`, label: `${label} · ${g}`,
        color: gk === "muslims" && g === "both" ? "#2E4BD8" : GREYS[mi++ % GREYS.length],
        data: data(toMap(rows)), unit: "count",
      };
    }
  }
  const minorityBundle = {
    meta: {
      ...metaBase,
      coverage: "All India; enrolment of Persons With Disability and minority communities (Muslims, Other Minority Communities, EWS) by gender, all five survey years.",
      note: yrNote + " EWS (Economically Weaker Sections) is a reservation category introduced after the 2019 constitutional amendment; the API carries no EWS data before 2019-20, so that series starts there — a disclosed gap, not a fetch failure. These are enrolment counts, not rates: the denominator (the eligible population in each group) is not served, so no GER-style ratio is computed for these groups.",
    },
    dates, series: minSeries,
  };

  writeSeries(root, "data/series/aishe-headline.json", headlineBundle);
  writeSeries(root, "data/series/aishe-access.json", accessBundle);
  writeSeries(root, "data/series/aishe-composition.json", compositionBundle);
  writeSeries(root, "data/series/aishe-states.json", statesBundle);
  writeSeries(root, "data/series/aishe-teachers.json", teachersBundle);
  writeSeries(root, "data/series/aishe-minority.json", minorityBundle);
  return headlineBundle;
}

/* Catalogue (docs/CONTRACT-coverage.md): aishe/getAisheIndicatorList and
 * aishe/getAisheFilterByIndicatorId, one cut at a time: aishe:<indicator>:all | :<dimension>:<value>. */
import { writeCatalogue, indicatorCatalogue, catalogueCli } from "../catalogue.mjs";
export async function catalogueAishe() {
  const inds = (await mospi("aishe/getAisheIndicatorList", {})).data ?? [];
  const items = await indicatorCatalogue({ mospi, prefix: "aishe", indicators: Array.isArray(inds) ? inds : inds.indicator ?? [],
    filter: (ind) => ["aishe/getAisheFilterByIndicatorId", { indicator_code: ind.indicator_code }] });
  writeCatalogue("aishe", { source: "Ministry of Education: All India Survey on Higher Education (via MoSPI eSankhyiki)",
    generator: "scripts/lib/products/aishe.mjs --catalogue",
    note: "From getAisheIndicatorList and getAisheFilterByIndicatorId: one cut at a time. All five survey years sit inside every item.", items });
}
await catalogueCli(import.meta.url, catalogueAishe);
