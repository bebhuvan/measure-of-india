// scripts/lib/products/aishe.mjs — All India Survey on Higher Education.
//
// Nine indicators (aishe/getAisheIndicatorList), five survey years
// (2017-18 to 2021-22), ~17k rows in total — every indicator is ingested IN
// FULL (paged, limit=500, keyed by indicator_code only) and sliced
// client-side, the same approach as hces/rbi. Fiscal-year labels plot at
// April of the first year ("2021-22" -> 2021-04).
//
// TEACHERS, 2021-22 (corrected 2026-10-10). The dump fetched on 2026-08-09 held duplicated
// rows: the API's pages came back in an unstable order (limit 500 then), so some rows
// appeared twice and others not at all, and the 2021-22 teacher rows looked garbled ("All
// Teacher" = 12,904, a near-zero residual). That was read as a source defect and the total
// was rebuilt from five faculty types. A clean refetch (2026-10-10, 100-row pages, no
// duplicate keys) shows the published rows are sound: All Teacher 2021-22 = 15,97,688, and
// All Teacher equals the six faculty types (the five regular posts plus visiting teachers)
// in 546 of 549 state x year x gender cells (All India 2020-21 differs by 34 in 15.5 lakh).
// Every page set is now checked for duplicate keys and the fetch fails if it finds any.
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
import fs from "node:fs";
import path from "node:path";

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
  // unstable paging shows up as the same row twice (and another missing): never bake that
  const seen = new Set();
  for (const r of rows) {
    const { value, ...dims } = r;
    const k = JSON.stringify(dims);
    if (seen.has(k)) throw new Error(`AISHE indicator ${code}: duplicate row ${k}: the API paged unstably; refetch with MOSPI_NO_CACHE=1`);
    seen.add(k);
  }
  return rows;
}

export async function buildAishe(root, dcfg, vintage) {
  const byInd = {};
  for (const code of Object.keys(dcfg.fetch.indicators)) byInd[code] = await fetchAll(code);
  writeRaw(root, "data/raw/aishe-records.json", {
    vintage,
    note: "Complete row-sets of all 9 AISHE indicators from aishe/getAisheRecords, survey years 2017-18 to 2021-22, 100-row pages, checked for duplicate rows (see the adapter header for the 2026-08-09 dump that had them).",
    indicators: byInd,
  });
  // vintage = the date the DATA last changed: writeRaw keeps the dump's old stamp when the
  // body is unchanged, and the bundles carry that stamp, never the run date (hard rule 5)
  vintage = JSON.parse(fs.readFileSync(path.join(root, "data/raw/aishe-records.json"), "utf8")).vintage;

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

  // teachers: the published "All Teacher" total, Both genders
  const tRows = ai(byInd["9"]);
  const teacherMap = toMap(tRows.filter((r) => r.faculty_type === "All Teacher" && r.gender === "Both"));

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
      note: yrNote + " Teachers are the published 'All Teacher' total in every year, which equals the five regular posts plus visiting teachers.",
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
  // every faculty type the survey publishes, the total last
  const FAC = [
    ["Professor & Equivalent", "professor", "Professor & Equivalent"],
    ["Reader & Associate Professor", "reader_associate", "Reader / Associate Prof."],
    ["Lecturer/Assistant Professor", "lecturer_assistant", "Lecturer / Asst. Prof."],
    ["Demonstrator/Tutor", "demonstrator", "Demonstrator / Tutor"],
    ["Temporary Teacher etc.", "temporary", "Temporary Teacher"],
    ["Visiting Teacher", "visiting", "Visiting Teacher"],
    ["All Teacher", "all", "All teachers"],
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
      coverage: "All India; teachers by faculty type (the five regular posts, visiting teachers, and all teachers) × gender (Both/Male/Female), all five survey years.",
      note: yrNote + " The faculty hierarchy runs from Professor & Equivalent (the senior-most rank) down to Temporary Teacher; visiting teachers are guest faculty. The six types sum to 'All teachers' (asserted in scripts/validate.mjs, which allows the 34-teacher difference the survey prints for All India 2020-21).",
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

  /* =========================================================
   *  Wave 2 (2026-10-10): every indicator at every cut the API serves.
   *  One series per state (All India included, as its own row) x the indicator's
   *  own dimensions, exactly as published. Nothing is summed or filled; the
   *  survey's own small inconsistencies are kept as published.
   * ========================================================= */
  const GEO = (rows) => [...new Set(rows.map((r) => String(r.state).trim()))].sort((a, b) => (a === "All India" ? -1 : b === "All India" ? 1 : a < b ? -1 : 1));
  const withGaps = (s, note) => {
    const first = s.data.findIndex((v) => v != null);
    const last = s.data.length - 1 - [...s.data].reverse().findIndex((v) => v != null);
    const gaps = s.data.map((v, i) => (v == null && i > first && i < last ? dates[i] : null)).filter(Boolean);
    if (gaps.length) { s.gaps = gaps; s.gapsNote ??= note; }
    return s;
  };
  const NOT_SERVED = "The survey does not report this cut for this state in these years; left empty, never filled.";
  const deep = (rows, dimsOf, unit) => {
    const series = {};
    let i = 0;
    for (const st of GEO(rows)) {
      const sr = rows.filter((r) => String(r.state).trim() === st);
      const combos = new Map();
      for (const r of sr) { const d = dimsOf(r); if (d) combos.set(d.key, d); }
      for (const d of [...combos.values()].sort((a, b) => a.order - b.order)) {
        const m = toMap(sr.filter((r) => dimsOf(r)?.key === d.key));
        if (!m.size) continue;
        const key = `${slugify(st)}__${d.key}`;
        series[key] = withGaps({ name: `aishe_${key}`, label: `${d.label} · ${st}`, group: st, color: GREYS[i++ % GREYS.length],
          data: data(m), unit: d.unit ?? unit }, NOT_SERVED);
      }
    }
    return series;
  };
  const G = { both: 0, male: 1, female: 2 };
  const gk = (r) => String(r.gender).trim().toLowerCase();
  const gl = (g) => ({ both: "women and men", male: "men", female: "women" })[g];

  // universities and colleges by state
  const instSeries = {
    ...deep(byInd["1"], () => ({ key: "universities", label: "Universities", order: 0 }), "count"),
    ...deep(byInd["2"], () => ({ key: "colleges", label: "Colleges", order: 1 }), "count"),
  };
  const institutionsBundle = { meta: { ...metaBase,
    coverage: "States/UTs and All India; number of universities and of colleges, five survey years.",
    note: yrNote + " Universities are reported for 33 states and UTs: the smallest UTs (Andaman and Nicobar Islands, Lakshadweep, Dadra and Nagar Haveli and Daman and Diu) have colleges but no university of their own." },
    dates, series: instSeries };

  // enrolment by state x level x gender
  const LV = Object.fromEntries([...EDU_ORDER.map(([src, k, l], i) => [src, [k, l, i]]), ["Grand Total", ["grand_total", "All levels", 9]]]);
  const enrolSeries = deep(byInd["3"], (r) => { const lv = LV[String(r.education_level).trim()]; const g = gk(r); if (!lv || !(g in G)) return null;
    return { key: `${lv[0]}_${g}`, label: `Enrolment, ${lv[1]}, ${gl(g)}`, order: lv[2] * 3 + G[g] }; }, "count");
  const enrolmentBundle = { meta: { ...metaBase,
    coverage: "States/UTs and All India; estimated student enrolment by level (Ph.D. to certificate, and all levels) and by gender, five survey years.",
    note: yrNote + " In every state and year the eight levels sum to 'All levels', and women plus men to the total (asserted in scripts/validate.mjs)." },
    dates, series: enrolSeries };

  // enrolment by social group (ind 4) and by minority / PWD / EWS (ind 5), state x gender
  const SGL = { all: ["all", "All categories"], sc: ["sc", "Scheduled Castes"], st: ["st", "Scheduled Tribes"], obc: ["obc", "Other Backward Classes"] };
  const socialSeries = deep(byInd["4"], (r) => { const c = SGL[normSocial(r.social_category)]; const g = gk(r); if (!c || !(g in G)) return null;
    return { key: `${c[0]}_${g}`, label: `Enrolment, ${c[1]}, ${gl(g)}`, order: ["all", "sc", "st", "obc"].indexOf(c[0]) * 3 + G[g] }; }, "count");
  const socialBundle = { meta: { ...metaBase,
    coverage: "States/UTs and All India; estimated student enrolment of Scheduled Castes, Scheduled Tribes and Other Backward Classes, and of all categories, by gender, five survey years.",
    note: yrNote + " The survey publishes no 'general' or 'others' group: all categories minus the three named groups is everyone else, but it is not baked as a series of its own." },
    dates, series: socialSeries };
  const MINL = Object.fromEntries(MIN.map(([src, k, l], i) => [src, [k, l, i]]));
  const minStSeries = deep(byInd["5"], (r) => { const c = MINL[String(r.social_group).trim()]; const g = gk(r); if (!c || !(g in G)) return null;
    return { key: `${c[0]}_${g}`, label: `Enrolment, ${c[1]}, ${gl(g)}`, order: c[2] * 3 + G[g] }; }, "count");
  const minorityStatesBundle = { meta: { ...metaBase,
    coverage: "States/UTs and All India; enrolment of Muslims, other minority communities, Economically Weaker Sections and persons with disability, by gender, five survey years.",
    note: yrNote + " EWS starts in 2019-20, when the category was created. Counts, not rates: the survey publishes no population base for these groups." },
    dates, series: minStSeries };

  // GER (ind 6) by state x social category x gender, and GPI (ind 7) by state x social category
  const gerSeries = {
    ...deep(byInd["6"], (r) => { const c = SGL[normSocial(r.social_category)]; const g = gk(r); if (!c || !(g in G)) return null;
      return { key: `ger_${c[0]}_${g}`, label: `GER, ${c[1]}, ${gl(g)}`, order: ["all", "sc", "st"].indexOf(c[0]) * 3 + G[g], unit: "percent" }; }),
    ...deep(byInd["7"], (r) => { const c = SGL[normSocial(r.social_category)]; if (!c) return null;
      return { key: `gpi_${c[0]}`, label: `Gender parity index, ${c[1]}`, order: 20 + ["all", "sc", "st"].indexOf(c[0]), unit: "index" }; }),
  };
  const gerBundle = { meta: { ...metaBase,
    coverage: "States/UTs and All India; gross enrolment ratio (18-23 year olds) for all categories, Scheduled Castes and Scheduled Tribes, by gender, and the gender parity index for each, five survey years.",
    note: yrNote + " Where a state has almost no Scheduled Tribe population (Punjab, Haryana, Delhi, Chandigarh, Puducherry) the survey reports no ST ratio." },
    dates, series: gerSeries };

  // pupil-teacher ratio (ind 8) by state x learning mode x institution type
  const IT = { "All Institutions": ["all", "all institutions", 0], "University & Colleges": ["univ_colleges", "universities and colleges", 1], "University & its Constituent Units": ["univ_units", "universities and their own units", 2] };
  const LM = { "Regular and Distance": ["reg_dist", "regular and distance", 0], "Regular": ["regular", "regular only", 1] };
  const ptrSeries = deep(byInd["8"], (r) => { const t = IT[String(r.institution_type).trim()], m = LM[String(r.learning_mode).trim()]; if (!t || !m) return null;
    return { key: `ptr_${m[0]}_${t[0]}`, label: `Pupils per teacher, ${t[1]}, ${m[1]} students`, order: m[2] * 3 + t[2] }; }, "pupils_per_teacher");
  const ptrBundle = { meta: { ...metaBase,
    coverage: "States/UTs and All India; pupil-teacher ratio (students per teacher) by institution type (all institutions, universities and colleges, universities and their own units) and by mode (regular and distance students together, or regular students only), five survey years.",
    note: yrNote + " Distance-learning students are counted in the 'regular and distance' ratio, so it runs above the regular-only ratio wherever open universities enrol many students." },
    dates, series: ptrSeries };

  // teachers (ind 9) by state x faculty type x gender; the 2021-22 total and visiting rows left empty
  const FT = { "Professor & Equivalent": ["professor", "professors", 0], "Reader & Associate Professor": ["reader_associate", "readers and associate professors", 1],
    "Lecturer/Assistant Professor": ["lecturer_assistant", "lecturers and assistant professors", 2], "Demonstrator/Tutor": ["demonstrator", "demonstrators and tutors", 3],
    "Temporary Teacher etc.": ["temporary", "temporary teachers", 4], "Visiting Teacher": ["visiting", "visiting teachers", 5], "All Teacher": ["all", "all teachers", 6] };
  const tchStSeries = deep(byInd["9"], (r) => { const f = FT[String(r.faculty_type).trim()]; const g = gk(r); if (!f || !(g in G)) return null;
    return { key: `${f[0]}_${g}`, label: `Teachers, ${f[1]}, ${gl(g)}`, order: f[2] * 3 + G[g] }; }, "count");
  const teachersStatesBundle = { meta: { ...metaBase,
    coverage: "States/UTs and All India; teachers by post (professor to temporary teacher, visiting teachers, all teachers) and by gender, five survey years.",
    note: yrNote + " The six posts sum to all teachers in every state and year but one (All India 2020-21, 34 teachers apart in 15.5 lakh, as published)." },
    dates, series: tchStSeries };

  writeSeries(root, "data/series/aishe-headline.json", headlineBundle);
  writeSeries(root, "data/series/aishe-access.json", accessBundle);
  writeSeries(root, "data/series/aishe-composition.json", compositionBundle);
  writeSeries(root, "data/series/aishe-states.json", statesBundle);
  writeSeries(root, "data/series/aishe-teachers.json", teachersBundle);
  writeSeries(root, "data/series/aishe-minority.json", minorityBundle);
  writeSeries(root, "data/series/aishe-states-institutions.json", institutionsBundle);
  writeSeries(root, "data/series/aishe-states-enrolment.json", enrolmentBundle);
  writeSeries(root, "data/series/aishe-states-social.json", socialBundle);
  writeSeries(root, "data/series/aishe-states-minority.json", minorityStatesBundle);
  writeSeries(root, "data/series/aishe-states-ger.json", gerBundle);
  writeSeries(root, "data/series/aishe-ptr.json", ptrBundle);
  writeSeries(root, "data/series/aishe-states-teachers.json", teachersStatesBundle);
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
