// scripts/lib/worldbank.mjs — the World Bank family client (API v2: WDI,
// Data360). Transport for dossiers with `family: worldbank` in
// data/sources.yml; used by the scripts/lib/products/worldbank-*.mjs
// adapters, which should never hand-roll HTTP.
//
// Envelope shape (format=json):
//   success: [{ page, pages, total, per_page, lastupdated, ... }, [rows...]]
//   error:   [{ message: [{ id, key, value }] }]          (HTTP 200!)
//   empty:   [{ page: 1, pages: 0, total: 0, ... }, null]
// wb() follows `pages` sequentially (one request in flight, ~350ms apart,
// mirroring mospi.mjs's politeness), concatenates the row arrays, and throws
// on the error envelope.
//
// Unlike api.mospi.gov.in this host needs no legacy TLS; requests go through
// net.mjs's getJson (deadline, size cap, retry/backoff). The resume cache
// from mospi.mjs transfers cleanly, so it is mirrored here: every response
// page is written to data/raw/http-cache/<sha1(url)>.json and reused within
// WB_CACHE_TTL_H hours; WB_NO_CACHE=1 bypasses reads.

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { getJson } from "./net.mjs";

const BASE = "https://api.worldbank.org/v2/";

// ---------------------------------------------------------------------------
// Resume cache — same scheme as mospi.mjs (sha1(url) under
// data/raw/http-cache), so a died-mid-ingest run resumes instead of
// refetching. Independent TTL/bypass env vars.
// ---------------------------------------------------------------------------
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const CACHE_DIR = path.join(ROOT, "data/raw/http-cache");
const CACHE_TTL_H = Number(process.env.WB_CACHE_TTL_H ?? 20);
const NO_CACHE = process.env.WB_NO_CACHE === "1";

function cachePath(url) {
  return path.join(CACHE_DIR, crypto.createHash("sha1").update(url).digest("hex") + ".json");
}
function cacheRead(url) {
  if (NO_CACHE) return null;
  try {
    const raw = JSON.parse(fs.readFileSync(cachePath(url), "utf8"));
    if (Date.now() - raw.fetchedAt > CACHE_TTL_H * 3600_000) return null;
    return raw.body;
  } catch {
    return null;
  }
}
function cacheWrite(url, body) {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  fs.writeFileSync(cachePath(url), JSON.stringify({ url, fetchedAt: Date.now(), body }));
}

// ---------------------------------------------------------------------------
// Global throttle: one request in flight at a time, spaced MIN_GAP_MS apart.
// ---------------------------------------------------------------------------
const MIN_GAP_MS = Number(process.env.WB_GAP_MS ?? 350);
let queue = Promise.resolve();
let lastRequestAt = 0;

async function getPage(url) {
  const cached = cacheRead(url);
  if (cached) return cached;
  const run = queue.then(async () => {
    const wait = Math.max(0, lastRequestAt + MIN_GAP_MS - Date.now());
    if (wait) await new Promise((r) => setTimeout(r, wait));
    lastRequestAt = Date.now();
    return getJson(url, { gapMs: 0 });
  });
  queue = run.catch(() => {});
  const json = await run;
  cacheWrite(url, json);
  return json;
}

// One logical call = every page of a WB endpoint, concatenated.
// `path` is the API path ("country/IND/indicator/NY.GDP.MKTP.CD"); params
// always carry format=json and per_page=500 (callers may override per_page).
export async function wb(apiPath, params = {}) {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries({ per_page: 500, ...params, format: "json" })) qs.set(k, String(v));
  const pageUrl = (page) => `${BASE}${apiPath}?${qs.toString()}&page=${page}`;

  const first = await getPage(pageUrl(1));
  if (!Array.isArray(first)) throw new Error(`World Bank: non-envelope response for ${apiPath}`);
  const [meta, rows] = first;
  if (meta?.message) {
    const msg = meta.message.map((m) => m.value ?? m.key).join("; ");
    throw new Error(`World Bank API error for ${apiPath}: ${msg}`);
  }
  if (!Array.isArray(rows)) return []; // valid "no data" envelope: rows is null
  const out = [...rows];
  for (let page = 2; page <= (meta.pages ?? 1); page++) {
    const [, more] = await getPage(pageUrl(page));
    if (Array.isArray(more)) out.push(...more);
  }
  return out;
}
