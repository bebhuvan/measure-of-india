// scripts/lib/cckp.mjs: the family client for the World Bank Climate Change Knowledge
// Portal (CCKP). Transport for `family: cckp` in data/sources.yml; used by
// scripts/lib/products/cckp.mjs, which never hand-rolls HTTP. Notes on the API, learned
// by probing it (2026-10-09), live in docs/reference/cckp.md.
//
// Two hosts:
//   1. The aggregation API, https://cckpapi.worldbank.org/cckp/v1/<eleven facets>/<geocodes>
//      ?_format=json. The facets are joined by "_": collection, type, variable, product,
//      aggregation, period, percentile, scenario, model, model calculation, statistic.
//      EVERY facet and the geocode list accept comma lists, so one call can return many
//      variables, scenarios, percentiles and places at once. The response nests one level
//      per facet that was given as a list (variable > aggregation/period > percentile >
//      scenario > geocode > "YYYY-MM": value). Envelope: { metadata: { status }, data }.
//      An unknown combination returns status "success" with data [] (no error), so callers
//      assert what they expect.
//   2. The public S3 bucket wbg-cckp (https://wbg-cckp.s3.amazonaws.com), which holds the
//      gridded NetCDF files the API aggregates. Its listing is the portal's own catalogue
//      of collections, variables, datasets and products: the catalogue generator reads it.
//
// Politeness: one request in flight, CCKP_GAP_MS apart (default 400 ms). Every response is
// cached under data/raw/http-cache/<sha1(url)>.json for CCKP_CACHE_TTL_H hours (default 20),
// the same resume scheme as mospi.mjs and worldbank.mjs; CCKP_NO_CACHE=1 bypasses reads.

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { getJson, getText } from "./net.mjs";

export const API = "https://cckpapi.worldbank.org/cckp/v1/";
export const S3 = "https://wbg-cckp.s3.amazonaws.com/";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const CACHE_DIR = path.join(ROOT, "data/raw/http-cache");
const CACHE_TTL_H = Number(process.env.CCKP_CACHE_TTL_H ?? 20);
const NO_CACHE = process.env.CCKP_NO_CACHE === "1";
const MIN_GAP_MS = Number(process.env.CCKP_GAP_MS ?? 400);

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
function polite(fn) {
  const run = queue.then(async () => {
    const wait = Math.max(0, lastAt + MIN_GAP_MS - Date.now());
    if (wait) await new Promise((r) => setTimeout(r, wait));
    lastAt = Date.now();
    return fn();
  });
  queue = run.catch(() => {});
  return run;
}

async function cached(url, fetcher) {
  const hit = cacheRead(url);
  if (hit != null) return hit;
  const body = await polite(fetcher);
  cacheWrite(url, body);
  return body;
}

/** The eleven facets, in order, joined into the API's path segment. */
export function facetCode(f) {
  const list = (v) => (Array.isArray(v) ? v.join(",") : v);
  return [f.collection, f.type, list(f.variable), f.product, list(f.aggregation), list(f.period), list(f.percentile),
    list(f.scenario), f.model, f.calc, f.statistic].join("_");
}

/** One API call. Returns the `data` member; throws on an error envelope. */
export async function cckp(facets, geocodes) {
  const code = typeof facets === "string" ? facets : facetCode(facets);
  const url = `${API}${code}/${[].concat(geocodes).join(",")}?_format=json`;
  const body = await cached(url, () => getJson(url, { gapMs: 0, deadlineMs: 300_000 }));
  if (body?.metadata?.status !== "success") {
    const msg = [].concat(body?.metadata?.message ?? body?.metadata?.messages ?? []).join("; ");
    throw new Error(`CCKP API error for ${code}: ${msg || "no status"}`);
  }
  return { url, data: body.data };
}

/** Every key and common prefix under an S3 prefix (follows continuation tokens). */
export async function s3List(prefix) {
  const keys = [], prefixes = [];
  let token = null;
  for (;;) {
    const url = `${S3}?list-type=2&delimiter=/&prefix=${encodeURIComponent(prefix)}${token ? `&continuation-token=${encodeURIComponent(token)}` : ""}`;
    const xml = await cached(url, () => getText(url, { gapMs: 0, markup: true }));
    for (const m of xml.matchAll(/<Key>([^<]*)<\/Key>/g)) keys.push(m[1]);
    for (const m of xml.matchAll(/<Prefix>([^<]*)<\/Prefix>/g)) if (m[1] !== prefix) prefixes.push(m[1]);
    const next = xml.match(/<NextContinuationToken>([^<]*)<\/NextContinuationToken>/);
    if (!next) break;
    token = next[1];
  }
  return { keys, prefixes };
}

/**
 * Geocode -> place name. The JSON API returns codes only; its xlsx output carries a
 * "name" column. The workbook is read with the system `unzip` (tabular.mjs: convert
 * spreadsheets upstream rather than adding a parser), and only its shared-strings table
 * is used, which lists each code followed by its name.
 */
export async function geoNames(facets, geocodes) {
  const code = typeof facets === "string" ? facets : facetCode(facets);
  const url = `${API}${code}/${[].concat(geocodes).join(",")}?_format=xlsx`;
  const latin1 = await cached(url, () => getText(url, { gapMs: 0, encoding: "latin1" }));
  const tmp = path.join(os.tmpdir(), `cckp-names-${process.pid}.xlsx`);
  fs.writeFileSync(tmp, Buffer.from(latin1, "latin1"));
  let xml;
  try { xml = execFileSync("unzip", ["-p", tmp, "xl/sharedStrings.xml"], { encoding: "utf8" }); }
  finally { fs.rmSync(tmp, { force: true }); }
  const strings = [...xml.matchAll(/<t[^>]*>([^<]*)<\/t>/g)].map((m) => m[1].replace(/&amp;/g, "&").replace(/&apos;/g, "'"));
  const names = new Map();
  const wanted = new Set([].concat(geocodes));
  for (let i = 0; i < strings.length - 1; i++) if (wanted.has(strings[i])) names.set(strings[i], strings[i + 1]);
  return names;
}

/** CCKP codes missing values as a float fill (about 1e20); no real climate value is near it. */
export const isFill = (v) => v == null || !Number.isFinite(v) || Math.abs(v) >= 1e15;
