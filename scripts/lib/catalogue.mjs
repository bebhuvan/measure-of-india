// scripts/lib/catalogue.mjs: writing a source catalogue for the coverage gate
// (docs/CONTRACT-coverage.md). Each adapter's `--catalogue` mode enumerates what its source
// publishes, from the source's own listing (MoSPI filter and indicator calls, the World Bank
// indicator list, the DBIE report catalogue), and hands the items here.
//
//   node scripts/lib/products/<adapter>.mjs --catalogue
//
// Items are written one per line, sorted by id, so a regenerated catalogue diffs cleanly and
// a source that grows shows up as added lines. Ids are lowercase, colon-separated, coarse to
// fine, so a ledger glob can address a branch (`cpi:2024:*:*:item:*`).
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";
import YAML from "yaml";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

/** "Andhra Pradesh" -> "andhra-pradesh": the id form of a name. */
export const idPart = (s) => String(s ?? "").toLowerCase().normalize("NFKD").replace(/[^a-z0-9.]+/g, "-").replace(/^-+|-+$/g, "") || "none";

export function writeCatalogue(family, { source, generator, note, items }) {
  const seen = new Map();
  for (const it of items) {
    if (!/^[a-z0-9][a-z0-9.:_-]*$/.test(it.id)) throw new Error(`catalogue ${family}: bad id "${it.id}"`);
    if (seen.has(it.id)) continue;   // the listing can repeat a node; one entry per id
    seen.set(it.id, it);
  }
  const list = [...seen.values()].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const head = { family, source, generator, generated_at: new Date().toISOString().slice(0, 10), ...(note ? { note } : {}), count: list.length };
  const body = JSON.stringify(head, null, 1).replace(/\n}$/, "");
  const out = body + ',\n "items": [\n' + list.map((it) => "  " + JSON.stringify(it)).join(",\n") + "\n ]\n}\n";
  const file = writeCatalogueText(path.join(ROOT, "data/coverage", family + ".catalogue.json"), out);
  console.log(`catalogue ${family}: ${list.length} items -> ${path.relative(ROOT, file)}`);
  return list.length;
}

/* Catalogues over GZ_OVER bytes are stored gzipped (<name>.catalogue.json.gz) so no tracked
 * file nears the 25 MB repo limit (docs/PLAN-launch.md §2b). Ledgers keep naming the plain
 * .json path; readCatalogue falls back to the .gz. gzipSync leaves the header mtime at 0, so
 * a regenerated catalogue with the same items is byte-identical. */
export const GZ_OVER = 20e6;
export function writeCatalogueText(file, text) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const gz = Buffer.byteLength(text) > GZ_OVER, target = gz ? file + ".gz" : file, stale = gz ? file : file + ".gz";
  fs.writeFileSync(target + ".tmp", gz ? zlib.gzipSync(text, { level: 9 }) : text);
  fs.renameSync(target + ".tmp", target);
  fs.rmSync(stale, { force: true });
  return target;
}
/** A catalogue by its ledger path (plain or gzipped), or null when neither exists. */
export function readCatalogue(rel, root = ROOT) {
  const file = path.isAbsolute(rel) ? rel : path.join(root, rel);
  if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, "utf8"));
  if (fs.existsSync(file + ".gz")) return JSON.parse(zlib.gunzipSync(fs.readFileSync(file + ".gz")).toString("utf8"));
  return null;
}

/** The adapter's sources.yml entry, for catalogue modes that need its fetch params. */
export function sourceCfg(key) {
  const cfg = YAML.parse(fs.readFileSync(path.join(ROOT, "data/sources.yml"), "utf8"));
  return { cfg, dcfg: cfg.dossiers?.[key] };
}

/** Run `fn` when the adapter module is executed directly with --catalogue. */
export async function catalogueCli(metaUrl, fn) {
  if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(metaUrl) && process.argv.includes("--catalogue")) {
    try { await fn(); } catch (e) { console.error(`catalogue failed: ${e.stack || e.message}`); process.exit(1); }
  }
}

/* The common MoSPI survey shape: an indicator list, and a filter listing per indicator that
 * names its dimensions (state, sector, gender, round...). One item per indicator x one cut,
 * the other dimensions at their headline, which is what docs/CONTRACT-coverage.md calls an
 * item. Dimensions in `cross` (a survey round, an imputation basis, a sub-indicator) are
 * different measures, not cuts: every item is crossed with each of their values.
 *   <prefix>:<indicator>[:<cross values>]:all
 *   <prefix>:<indicator>[:<cross values>]:<dimension>:<value>
 * Values are named by their code where the listing gives one (code-slug, slug cut at 40). */
const nameOf = (v) => v.label ?? v.description ?? v[Object.keys(v).find((k) => /(_name|_label|description)$/.test(k))] ?? Object.values(v).find((x) => typeof x === "string") ?? "";
const codeOf = (v) => v.id ?? v[Object.keys(v).find((k) => /(_code|_id)$/.test(k))] ?? null;
export const valuePart = (v, { codes = true } = {}) => {
  const slug = idPart(String(nameOf(v)).trim()).slice(0, 40).replace(/-+$/, "");
  const c = codeOf(v);
  return codes && c != null && String(c) !== "" ? `${idPart(c)}-${slug}` : slug;
};
export const HEADLINE = /^(all|all india|all-india|total|combined|rural \+ urban.*|person|persons|both|total \(all\)|all categories)$/i;
export async function indicatorCatalogue({ mospi, prefix, indicators, filter, cross = [], skip = ["year", "quarter", "month"], nameCodes = ["state"], label = (ind) => ind.description ?? ind.label }) {
  const items = [];
  for (const ind of indicators) {
    const code = ind.indicator_code ?? ind.id;
    let f;
    try { f = (await mospi(...filter(ind))).data ?? {}; }
    catch (e) { if (/HTTP 4\d\d/.test(e.message)) continue; throw e; }
    if (Array.isArray(f)) f = f[0] ?? {};
    const dims = Object.entries(f).filter(([k, v]) => Array.isArray(v) && v.length && typeof v[0] === "object" && !skip.includes(k));
    const crossDims = dims.filter(([k]) => cross.includes(k));
    const cutDims = dims.filter(([k]) => !cross.includes(k));
    let combos = [[]];
    for (const [, vals] of crossDims) combos = combos.flatMap((c) => vals.map((v) => [...c, valuePart(v)]));
    for (const c of combos) {
      const head = [prefix, code, ...c].join(":");
      items.push({ id: `${head}:all`, label: String(label(ind)).trim() });
      for (const [dim, vals] of cutDims) for (const v of vals) {
        if (HEADLINE.test(String(nameOf(v)).trim())) continue;
        items.push({ id: `${head}:${idPart(dim)}:${valuePart(v, { codes: !nameCodes.includes(dim) })}` });
      }
    }
  }
  return items;
}
