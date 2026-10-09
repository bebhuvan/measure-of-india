// scripts/lib/products/cpialrl.mjs — CPI for Agricultural & Rural Labourers,
// Labour Bureau via eSankhyiki. All-India General Index + Group Index.
//
// The API ignores the base_year param: one records stream carries both bases,
// distinguished by each row's own base_year field. Per the base-year rule the
// two bases are emitted as separate bundles, never joined:
//   cpialrl-1986.json — y/y inflation on base 1986-87 (Jul 1999 – May 2025)
//   cpialrl-2019.json — index LEVELS on base 2019 (Jun 2025 – ), plus the
//     publisher's own y/y inflation (they hold a linked back-series we are
//     not given; labelled published, not computed).
//   cpialrl-groups-1986.json / cpialrl-groups-2019.json — same anatomy for
//     the five groups (indicator 2), All India; state × group stays raw.

import { mospi } from "../mospi.mjs";
import { MONTHS, writeSeries, writeRaw, yoyFromLevels, monthAxis } from "../util.mjs";

// Agriculture-year labels ("2024-2025" = Jul 2024–Jun 2025) and plain
// calendar-year labels ("2026") both appear. Returns "YYYY-MM".
function rowMonth(yearLabel, monthName) {
  const mi = MONTHS.indexOf(monthName);
  if (mi < 0) return null;
  const m = String(yearLabel);
  if (m.includes("-")) {
    const [y1, y2] = m.split("-").map(Number);
    const y = mi >= 6 ? y1 : y2; // Jul–Dec -> first year, Jan–Jun -> second
    return `${y}-${String(mi + 1).padStart(2, "0")}`;
  }
  return `${m}-${String(mi + 1).padStart(2, "0")}`;
}

export async function buildCpialrl(root, dcfg, vintage) {
  const { params, fields } = dcfg.fetch;
  const { state_code, ...baseParams } = params; // no state_code: one stream carries every state/UT for both bases
  const rows = [];
  let page = 1;
  for (;;) {
    const res = await mospi(dcfg.fetch.endpoint, { ...baseParams, page, limit: 500 });
    const batch = res.data ?? [];
    rows.push(...batch);
    if (page >= (res.meta_data?.totalPages ?? 1)) break;
    page++;
  }
  if (!rows.length) throw new Error("CPI-AL/RL: no data returned");
  process.stdout.write(`cpialrl: ${rows.length} rows (all states)\n`);

  const slugify = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
  const levels = { "1986": { al: new Map(), rl: new Map() }, "2019": { al: new Map(), rl: new Map() } };
  const stateLevels = { "1986": {}, "2019": {} }; // base -> stateKey -> {al: Map, rl: Map}
  const published = { al: new Map(), rl: new Map() }; // new base, All India only
  for (const r of rows) {
    const ym = rowMonth(r.year, r.month);
    if (!ym) continue;
    const base = String(r.base_year).startsWith("2019") ? "2019" : "1986";
    for (const [field, key] of Object.entries(fields)) {
      const v = parseFloat(r[field]);
      if (!Number.isFinite(v) || v === 0) continue; // unpublished cells arrive as "" or 0
      if (r.state === "All India") {
        levels[base][key].set(ym, v);
        if (base === "2019") {
          const inf = parseFloat(r[field.replace("index_", "inflation_")]);
          if (Number.isFinite(inf)) published[key].set(ym, inf);
        }
      } else {
        const sk = slugify(r.state);
        ((stateLevels[base][sk] ??= { al: new Map(), rl: new Map() })[key]).set(ym, v);
      }
    }
  }
  for (const b of ["1986", "2019"]) {
    process.stdout.write(`cpialrl base ${b}: ${levels[b].al.size} months (${[...levels[b].al.keys()].sort()[0]} .. ${[...levels[b].al.keys()].sort().at(-1)})\n`);
  }

  /* ---- group index (indicator 2): one stream, both bases, all states ----
     group names differ across bases ("Food" on 1986, "Food and Non Alcoholic
     Beverages" on 2019) — normalised to shared keys; the stream also carries
     a General Index group that duplicates indicator 1, skipped here. */
  const groupRows = [];
  {
    let page = 1;
    for (;;) {
      const res = await mospi(dcfg.fetch.endpoint, { ...baseParams, indicator_code: 2, page, limit: 500 });
      const batch = res.data ?? [];
      groupRows.push(...batch);
      if (page >= (res.meta_data?.totalPages ?? 1)) break;
      page++;
    }
  }
  process.stdout.write(`cpialrl groups: ${groupRows.length} rows\n`);

  const GROUP_KEY = (name) => {
    const k = slugify(name);
    return k === "food_and_non_alcoholic_beverages" ? "food" : k;
  };
  const GROUP_LABELS = {
    food: "Food",
    pan_tobacco_and_intoxicants: "Pan, tobacco",
    fuel_and_light: "Fuel & light",
    clothing_and_footwear: "Clothing & footwear",
    miscellaneous: "Miscellaneous",
  };
  const gLevels = { "1986": {}, "2019": {} }; // base -> gkey -> {al, rl}
  const gPublished = { al: {}, rl: {} }; // 2019 base, All India: gkey -> Map
  const gStates = { "1986": {}, "2019": {} }; // base -> stateKey -> gkey -> {al, rl}
  for (const r of groupRows) {
    if (r.group === "General Index") continue;
    const gk = GROUP_KEY(r.group ?? "");
    if (!GROUP_LABELS[gk]) continue;
    const ym = rowMonth(r.year, r.month);
    if (!ym) continue;
    const base = String(r.base_year).startsWith("2019") ? "2019" : "1986";
    for (const [field, key] of Object.entries(fields)) {
      const v = parseFloat(r[field]);
      if (!Number.isFinite(v) || v === 0) continue;
      if (r.state === "All India") {
        (((gLevels[base][gk] ??= { al: new Map(), rl: new Map() }))[key]).set(ym, v);
        if (base === "2019") {
          const inf = parseFloat(r[field.replace("index_", "inflation_")]);
          if (Number.isFinite(inf)) (gPublished[key][gk] ??= new Map()).set(ym, inf);
        }
      } else {
        const sk = slugify(r.state);
        ((((gStates[base][sk] ??= {})[gk] ??= { al: new Map(), rl: new Map() }))[key]).set(ym, v);
      }
    }
  }

  /* ---- old base: y/y inflation bundle ---- */
  const yoy86 = { al: yoyFromLevels(levels["1986"].al), rl: yoyFromLevels(levels["1986"].rl) };
  const m86 = [...yoy86.al.keys()].sort();
  const axis86 = monthAxis(m86[0], m86.at(-1));
  const bundle86 = {
    meta: {
      dossier: "cpialrl", frequency: "monthly", base: "1986-87=100",
      source: dcfg.source_agency, vintage, mock: false,
      geo: dcfg.geo ?? "IND",
      latestPeriod: m86.at(-1),
      releaseDate: null,
      note: "Old base. Superseded by base 2019=100 from June 2025 — plotted side by side, never spliced (base-year rule).",
      revisionPolicy: dcfg.revision_policy,
    },
    dates: axis86.map((ym) => `${ym}-01`),
    series: {
      al: { name: "cpi_al_yoy_pct_base1986", label: "Agri labourers", color: "#2E4BD8", data: axis86.map((ym) => yoy86.al.get(ym) ?? null) },
      rl: { name: "cpi_rl_yoy_pct_base1986", label: "Rural labourers", color: "#5F6675", data: axis86.map((ym) => yoy86.rl.get(ym) ?? null) },
    },
  };

  /* ---- new base: levels bundle + publisher's y/y ---- */
  const m19 = [...levels["2019"].al.keys()].sort();
  if (!m19.length) throw new Error("CPI-AL/RL: no base-2019 rows");
  const axis19 = monthAxis(m19[0], m19.at(-1));
  const bundle19 = {
    meta: {
      dossier: "cpialrl", frequency: "monthly", base: "2019=100",
      source: dcfg.source_agency, vintage, mock: false,
      geo: dcfg.geo ?? "IND",
      latestPeriod: m19.at(-1),
      releaseDate: null,
      note: "New base, from June 2025. Levels are published; y/y inflation is the publisher's own (computed on a linked back-series we are not given) until 13 months of levels exist.",
      revisionPolicy: dcfg.revision_policy,
    },
    dates: axis19.map((ym) => `${ym}-01`),
    series: {
      al: { name: "cpi_al_index_base2019", label: "Agri labourers", color: "#2E4BD8", data: axis19.map((ym) => levels["2019"].al.get(ym) ?? null), unit: "index" },
      rl: { name: "cpi_rl_index_base2019", label: "Rural labourers", color: "#5F6675", data: axis19.map((ym) => levels["2019"].rl.get(ym) ?? null), unit: "index" },
      al_published_yoy: { name: "cpi_al_yoy_pct_published", label: "AL inflation (published)", color: "#A3A9B4", data: axis19.map((ym) => published.al.get(ym) ?? null), unit: "pct" },
      rl_published_yoy: { name: "cpi_rl_yoy_pct_published", label: "RL inflation (published)", color: "#C9CED6", data: axis19.map((ym) => published.rl.get(ym) ?? null), unit: "pct" },
    },
  };

  const raw = { vintage, unit: "index; levels keyed by base year, General Index", levels: {} };
  for (const b of ["1986", "2019"]) {
    for (const [k, map] of Object.entries(levels[b])) raw.levels[`${k}_base${b}`] = Object.fromEntries([...map.entries()].sort());
    for (const [sk, m] of Object.entries(stateLevels[b])) {
      for (const [k, map] of Object.entries(m)) raw.levels[`${k}_base${b}:${sk}`] = Object.fromEntries([...map.entries()].sort());
    }
  }
  writeRaw(root, "data/raw/cpialrl-indices.json", raw);

  const rawGroups = { vintage, unit: "index; levels keyed by base year, Group Index (indicator 2)", levels: {} };
  for (const b of ["1986", "2019"]) {
    for (const [gk, m] of Object.entries(gLevels[b])) {
      for (const [k, map] of Object.entries(m)) rawGroups.levels[`${k}_base${b}:${gk}`] = Object.fromEntries([...map.entries()].sort());
    }
    for (const [sk, groups] of Object.entries(gStates[b])) {
      for (const [gk, m] of Object.entries(groups)) {
        for (const [k, map] of Object.entries(m)) rawGroups.levels[`${k}_base${b}:${gk}:${sk}`] = Object.fromEntries([...map.entries()].sort());
      }
    }
  }
  writeRaw(root, "data/raw/cpialrl-groups-indices.json", rawGroups);

  // states bundles — same base-year rule: old-base y/y and new-base levels
  // are separate files, never joined
  const GREYS = ["#5F6675", "#878D99", "#A3A9B4", "#C9CED6"];
  const stateBundle = (base, mode) => {
    const states = stateLevels[base];
    const allMonths = [...new Set(Object.values(states).flatMap((m) => [...m.al.keys()]))].sort();
    if (!allMonths.length) return null;
    const ax = monthAxis(allMonths[0], allMonths.at(-1));
    const series = {};
    Object.keys(states).sort().forEach((sk, i) => {
      const src = mode === "yoy" ? yoyFromLevels(states[sk].al) : states[sk].al;
      if (!src.size) return; // e.g. Delhi has RL but no AL series
      series[sk] = {
        name: `cpi_al_${sk}_${mode === "yoy" ? "yoy_pct" : "index"}_base${base}`,
        label: sk.replace(/_/g, " "), color: GREYS[i % GREYS.length],
        data: ax.map((ym) => src.get(ym) ?? null),
      };
    });
    return {
      meta: {
        dossier: "cpialrl", frequency: "monthly", base: base === "1986" ? "1986-87=100" : "2019=100",
        source: dcfg.source_agency, vintage, mock: false,
        geo: dcfg.geo ?? "IND",
        latestPeriod: allMonths.at(-1), releaseDate: null,
        coverage: `States/UTs, General Index (AL), base ${base === "1986" ? "1986-87" : "2019"}`,
        revisionPolicy: dcfg.revision_policy,
      },
      dates: ax.map((ym) => `${ym}-01`), series,
    };
  };
  const s86 = stateBundle("1986", "yoy");
  const s19 = stateBundle("2019", "levels");

  /* ---- group bundles, All India (AL); state × group stays in raw ----
     same base-year anatomy as the General Index bundles: old base y/y,
     new base levels + publisher's y/y */
  const groupBundle = (base, mode) => {
    const groups = gLevels[base];
    const keys = Object.keys(GROUP_LABELS).filter((gk) => groups[gk]?.al.size);
    if (!keys.length) return null;
    const allMonths = [...new Set(keys.flatMap((gk) => [...groups[gk].al.keys()]))].sort();
    const ax = monthAxis(allMonths[0], allMonths.at(-1));
    const series = {};
    keys.forEach((gk, i) => {
      if (mode === "yoy") {
        const yoy = yoyFromLevels(groups[gk].al);
        series[gk] = {
          name: `cpi_al_${gk}_yoy_pct_base${base}`,
          label: GROUP_LABELS[gk], color: GREYS[i % GREYS.length],
          data: ax.map((ym) => yoy.get(ym) ?? null),
        };
      } else {
        series[gk] = {
          name: `cpi_al_${gk}_index_base${base}`,
          label: GROUP_LABELS[gk], color: GREYS[i % GREYS.length],
          data: ax.map((ym) => groups[gk].al.get(ym) ?? null), unit: "index",
        };
        series[`${gk}_published_yoy`] = {
          name: `cpi_al_${gk}_yoy_pct_published`,
          label: `${GROUP_LABELS[gk]} (published y/y)`, color: GREYS[(i + 2) % GREYS.length],
          data: ax.map((ym) => gPublished.al[gk]?.get(ym) ?? null), unit: "pct",
        };
      }
    });
    return {
      meta: {
        dossier: "cpialrl", frequency: "monthly", base: base === "1986" ? "1986-87=100" : "2019=100",
        source: dcfg.source_agency, vintage, mock: false,
        geo: dcfg.geo ?? "IND",
        latestPeriod: allMonths.at(-1), releaseDate: null,
        coverage: `All India, Group Index (AL), base ${base === "1986" ? "1986-87" : "2019"}`,
        note: mode === "yoy" ? bundle86.meta.note : bundle19.meta.note,
        revisionPolicy: dcfg.revision_policy,
      },
      dates: ax.map((ym) => `${ym}-01`), series,
    };
  };
  const g86 = groupBundle("1986", "yoy");
  const g19 = groupBundle("2019", "levels");

  writeSeries(root, "data/series/cpialrl-1986.json", bundle86);
  writeSeries(root, "data/series/cpialrl-2019.json", bundle19);
  if (s86) writeSeries(root, "data/series/cpialrl-states-1986.json", s86);
  if (s19) writeSeries(root, "data/series/cpialrl-states-2019.json", s19);
  if (g86) writeSeries(root, "data/series/cpialrl-groups-1986.json", g86);
  if (g19) writeSeries(root, "data/series/cpialrl-groups-2019.json", g19);
  return bundle19;
}
