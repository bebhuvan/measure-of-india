// scripts/lib/products/profiles.mjs: the coverage catalogue of the state profiles
// (/states/<state>/, docs/briefs/state-profiles.md). The profiles bake nothing of their own:
// they read other families' bundles. What they must account for is (1) every measure for every
// state and union territory, (2) every table of the RBI Handbook of Statistics on Indian States
// a profile could use, and (3) the MoSPI rounds the brief names as gaps (NSS 73 and 75 to 80,
// the three Economic Censuses). The catalogue is generated from those listings:
//   (1) src/dossiers/profiles.js MEASURES x src/dossiers/states-key.js STATES;
//   (2) data/coverage/states.hbs-index.json, which the states adapter writes from the DBIE
//       report catalogue (one entry per Handbook report, table numbers as the RBI prints them);
//   (3) the eSankhyiki endpoint table in docs/reference/esankhyiki-api.md (the API's own
//       product list, as probed), one item per round.
//   node scripts/lib/products/profiles.mjs --catalogue
// With --ledger it also writes the measure-by-unit rules of data/coverage/profiles.yml between
// its "generated" markers: shown where the source has a figure for the unit, excluded (with
// the reason) where it has none. The other rules are written by hand.
import fs from "node:fs";
import path from "node:path";
import { writeCatalogue, catalogueCli, ROOT } from "../catalogue.mjs";

const PLATE = {
  income: "§02 Income and growth", structure: "§03 What the economy runs on", prices: "§04 Prices", work: "§05 Work and pay",
  households: "§06 How households live", health: "§07 Health", money: "§08 Money", industry: "§09 Industry, energy and exports",
  farms: "§10 Farms", education: "§11 Education", climate: "§12 Climate", finances: "§13 State finances",
};

async function items() {
  process.chdir(ROOT);
  const { STATES } = await import("../../../src/dossiers/states-key.js");
  const P = await import("../../../src/dossiers/profiles.js");
  const out = [];
  for (const m of P.MEASURES) for (const u of STATES)
    out.push({ id: `profile:${m.id.toLowerCase()}:${u.slug}`, label: `${m.label}, ${u.name}`, dims: { measure: m.id, unit: u.slug, section: m.section, bundle: m.bundle } });
  const hbs = JSON.parse(fs.readFileSync(path.join(ROOT, "data/coverage/states.hbs-index.json"), "utf8"));
  const seen = new Set();
  for (const t of hbs.tables) {
    const n = String(t.table).padStart(3, "0");
    if (seen.has(n)) continue;
    seen.add(n);
    const b = t.bundle ? JSON.parse(fs.readFileSync(path.join(ROOT, "data/series", t.bundle + ".json"), "utf8")) : null;
    out.push({ id: `hbs:t${n}`, label: b ? b.meta.hbs.title.replace(/^Table \d+\s*:\s*/i, "") : `Handbook table ${t.table}`, dims: { report: t.report, bundle: t.bundle ?? null } });
  }
  // NFHS-6 indicators, from the fact-sheet parse archived by profiles-nfhs6.mjs
  const { readRaw } = await import("../util.mjs");
  const n6 = readRaw(ROOT, "data/raw/profiles-nfhs6.json");
  for (const r of n6.rows.filter((x) => x.geography === "India"))
    out.push({ id: `nfhs6:i${String(r.indicator_no).padStart(3, "0")}`, label: `NFHS-6 indicator ${r.indicator_no}: ${r.indicator}`, dims: { indicator: +r.indicator_no } });
  const api = fs.readFileSync(path.join(ROOT, "docs/reference/esankhyiki-api.md"), "utf8");
  // step 5: every indicator the MoSPI listings returned (data/raw/profiles-mospi-index.json, phase A),
  // and one item per round for the rounds not listed (NSS 73, NSS 80 while its list fails)
  const planFile = path.join(ROOT, "data/raw/profiles-mospi-index.json");
  const plan = fs.existsSync(planFile) ? JSON.parse(fs.readFileSync(planFile, "utf8")) : { products: {} };
  for (const [pid, st] of Object.entries(plan.products)) for (const ind of st.indicators ?? [])
    out.push({ id: `mospi:${pid}:${ind.survey ?? "0"}:${ind.code}`, label: ind.label ?? `${pid} indicator ${ind.code}`, dims: { product: pid, rows: ind.expected, state: !!ind.hasState } });
  for (const [, r] of api.matchAll(/^\| nss-(\d+) \|/gm)) if (!plan.products[`nss${r}`]?.indicators?.length) out.push({ id: `mospi:nss:${r}`, label: `NSS round ${r}, state cuts`, dims: { product: `nss-${r}` } });
  const ec = /^\| ec(\d)\/(\d)\/(\d) \|/m.exec(api);
  if (ec) for (const r of ec.slice(1)) out.push({ id: `mospi:ec:${r}`, label: `Economic Census, round ${r}`, dims: { product: `ec${r}` } });
  return { out, P, STATES };
}

async function catalogue() {
  const { out } = await items();
  writeCatalogue("profiles", {
    source: "The state profiles' own inputs: every measure for every state and UT, every RBI Handbook of States table, and the MoSPI rounds the brief names",
    generator: "scripts/lib/products/profiles.mjs --catalogue",
    note: "profile:<measure>:<unit> from src/dossiers/profiles.js x states-key.js; hbs:t<table> from data/coverage/states.hbs-index.json; mospi:* from docs/reference/esankhyiki-api.md",
    items: out,
  });
}

async function ledger() {
  const { P, STATES } = await items();
  const lines = [];
  for (const m of P.MEASURES) {
    const none = STATES.filter((u) => !P.figure(m, u.slug));
    if (none.length) {
      lines.push(`  - match: [${none.map((u) => `"profile:${m.id.toLowerCase()}:${u.slug}"`).join(", ")}]`);
      lines.push(`    status: excluded`);
      lines.push(`    reason: "The source (${m.bundle}) publishes no ${m.label.toLowerCase()} for these units; the profile says so in place of a figure."`);
    }
    lines.push(`  - match: "profile:${m.id.toLowerCase()}:*"`);
    lines.push(`    status: shown`);
    lines.push(`    bundle: ${m.derive?.other ? `[${m.bundle}, ${m.derive.other}]` : m.bundle}`);
    lines.push(`    plate: "${PLATE[m.section]}"`);
  }
  // step 5 MoSPI products: every listed indicator, decided from the plan file and the bake report
  const planFile = path.join(ROOT, "data/raw/profiles-mospi-index.json"), bakeFile = path.join(ROOT, "data/coverage/profiles-mospi-bake.json");
  if (fs.existsSync(planFile)) {
    const plan = JSON.parse(fs.readFileSync(planFile, "utf8")), bake = fs.existsSync(bakeFile) ? JSON.parse(fs.readFileSync(bakeFile, "utf8")) : { undated: [], notSeries: [] };
    const usedBy = new Map(P.MEASURES.filter((m) => m.bundle.startsWith("profiles-mospi-")).map((m) => [m.bundle, m]));
    for (const [pid, st] of Object.entries(plan.products)) {
      if (pid === "tus" || pid === "nss80") continue;   // decided by hand above
      for (const ind of st.indicators ?? []) {
        const id = `mospi:${pid}:${ind.survey ?? "0"}:${ind.code}`, slug = `profiles-mospi-${pid}-${ind.survey ?? 0}-${ind.code}`;
        const onDisk = fs.existsSync(path.join(ROOT, "data/series", slug + ".json"));
        lines.push(`  - match: "${id}"`);
        if (ind.fetchError) { lines.push(`    status: blocked`, `    reason: ${JSON.stringify(`MoSPI pages this indicator in no fixed order or cut the read short: ${ind.fetchError.replace(/^mospiAll \S+ \{[^}]*\}: /, "")}; nothing partial is baked.`)}`); continue; }
        if (ind.expected === 0) { lines.push(`    status: excluded`, `    reason: "MoSPI lists this indicator but serves no rows for it (checked 2026-10-10)."`); continue; }
        if (bake.undated.includes(`${pid} ${ind.code}`)) { lines.push(`    status: excluded`, `    reason: "The source names no period for any row of this table, so it cannot sit on a dated axis; every row is in data/raw/profiles-mospi/."`); continue; }
        if (bake.notSeries.includes(`${pid} ${ind.code}`)) { lines.push(`    status: excluded`, `    reason: "A list of events or records (several to one place and year), not a series; every row is in data/raw/profiles-mospi/."`); continue; }
        if (!onDisk) { lines.push(`    status: excluded`, `    reason: "No row of this table names a state, All India or a period the bake can place; every row is in data/raw/profiles-mospi/."`); continue; }
        const m = usedBy.get(slug);
        if (m) lines.push(`    status: shown`, `    bundle: ${slug}`, `    plate: "${PLATE[m.section]}"`);
        else lines.push(`    status: baked`, `    bundle: ${slug}`);
      }
    }
  }
  // NFHS-6: the indicators a profile shows, then the rest, baked
  const used = [...new Set(P.MEASURES.filter((m) => m.bundle === "profiles-nfhs6").map((m) => { const k = [...P.cells(m).cur.values()][0]; return k.match(/__i(\d{3})__/)[1]; }))].sort();
  lines.push(`  - match: [${used.map((n) => `"nfhs6:i${n}"`).join(", ")}]`, `    status: shown`, `    bundle: [profiles-nfhs6, profiles-nfhs6-nfhs5]`, `    plate: "§06 How households live and §07 Health"`);
  lines.push(`  - match: "nfhs6:*"`, `    status: baked`, `    bundle: [profiles-nfhs6, profiles-nfhs6-nfhs5]`);
  const f = path.join(ROOT, "data/coverage/profiles.yml");
  const src = fs.readFileSync(f, "utf8");
  const a = src.indexOf("  # --- generated: measures x units"), b = src.indexOf("  # --- end generated");
  if (a < 0 || b < 0) throw new Error("profiles.yml: generated markers missing");
  const head = src.slice(0, src.indexOf("\n", a) + 1);
  fs.writeFileSync(f, head + lines.join("\n") + "\n" + src.slice(b));
  console.log(`profiles.yml: ${P.MEASURES.length} measures written`);
}

await catalogueCli(import.meta.url, async () => {
  await catalogue();
  if (process.argv.includes("--ledger")) await ledger();
});
