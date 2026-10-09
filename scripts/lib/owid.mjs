// scripts/lib/owid.mjs: the family client for Our World in Data (OWID). Transport for
// `family: owid` in data/sources.yml; used by scripts/lib/products/owid-climate.mjs.
// Notes on the endpoints, learned by probing them (2026-10-09), live in
// docs/reference/owid.md.
//
// Three kinds of resource, all public, no key, licence CC BY 4.0:
//   - the published datasets as CSV with a codebook: the CO2 and greenhouse-gas dataset
//     (owid-public.owid.io/data/co2/owid-co2-data.csv, codebook on GitHub owid/co2-data)
//     and the energy dataset (…/energy/owid-energy-data.csv, codebook owid/energy-data);
//   - grapher charts: https://ourworldindata.org/grapher/<slug>.csv?csvType=full and
//     <slug>.metadata.json (column metadata, citations) and <slug>.config.json (which
//     indicator ids the chart draws);
//   - indicator metadata: https://api.ourworldindata.org/v1/indicators/<id>.metadata.json
//     (catalog path, origins, and the entities the indicator covers).
// The site map (https://ourworldindata.org/sitemap.xml) lists every grapher chart; the
// catalogue generator reads it.
//
// Politeness: one request in flight, OWID_GAP_MS apart (default 300 ms). Responses are
// cached under data/raw/http-cache for OWID_CACHE_TTL_H hours (default 20); OWID_NO_CACHE=1
// bypasses reads. Large CSVs are cached too, so a re-run never refetches 30 MB.

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { getJson, getText } from "./net.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const CACHE_DIR = path.join(ROOT, "data/raw/http-cache");
const CACHE_TTL_H = Number(process.env.OWID_CACHE_TTL_H ?? 20);
const NO_CACHE = process.env.OWID_NO_CACHE === "1";
const MIN_GAP_MS = Number(process.env.OWID_GAP_MS ?? 300);

const cachePath = (url) => path.join(CACHE_DIR, crypto.createHash("sha1").update(url).digest("hex") + ".json");
function cacheRead(url) {
  if (NO_CACHE) return null;
  try {
    const raw = JSON.parse(fs.readFileSync(cachePath(url), "utf8"));
    if (Date.now() - raw.fetchedAt > CACHE_TTL_H * 3600_000) return null;
    return raw.body;
  } catch { return null; }
}
function cacheWrite(url, body) {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  fs.writeFileSync(cachePath(url), JSON.stringify({ url, fetchedAt: Date.now(), body }));
}

let queue = Promise.resolve();
let lastAt = 0;
async function fetchCached(url, fn) {
  const hit = cacheRead(url);
  if (hit != null) return hit;
  const run = queue.then(async () => {
    const wait = Math.max(0, lastAt + MIN_GAP_MS - Date.now());
    if (wait) await new Promise((r) => setTimeout(r, wait));
    lastAt = Date.now();
    return fn();
  });
  queue = run.catch(() => {});
  const body = await run;
  cacheWrite(url, body);
  return body;
}

export const owidText = (url, opts = {}) => fetchCached(url, () => getText(url, { gapMs: 0, deadlineMs: 300_000, ...opts }));
export const owidJson = (url) => fetchCached(url, () => getJson(url, { gapMs: 0 }));

export const GRAPHER = "https://ourworldindata.org/grapher/";
export const chartCsv = (slug) => owidText(`${GRAPHER}${slug}.csv?v=1&csvType=full&useColumnShortNames=true`);
export const chartMeta = (slug) => owidJson(`${GRAPHER}${slug}.metadata.json?v=1&useColumnShortNames=true`);
export const chartConfig = (slug) => owidJson(`${GRAPHER}${slug}.config.json`);
export const indicatorMeta = (id) => owidJson(`https://api.ourworldindata.org/v1/indicators/${id}.metadata.json`);
export const sitemap = () => owidText("https://ourworldindata.org/sitemap.xml", { markup: true });
