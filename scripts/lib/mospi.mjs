import https from "node:https";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { requestOnce } from "./net.mjs";

// api.mospi.gov.in requires legacy TLS renegotiation, disabled by default in
// OpenSSL 3 — enable it explicitly for this host only.
const agent = new https.Agent({
  secureOptions: crypto.constants.SSL_OP_LEGACY_SERVER_CONNECT,
  ciphers: "DEFAULT@SECLEVEL=1",
});

const BASE = "https://api.mospi.gov.in/api/";

// ---------------------------------------------------------------------------
// Resume cache. The host throttles hard on long ingests; a run that dies
// mid-product must not refetch the thousands of pages it already has. Every
// successful response is written to data/raw/http-cache/<sha1(url)>.json and
// reused within CACHE_TTL_H hours (same-day re-runs resume instantly, the
// next release cycle refetches). MOSPI_NO_CACHE=1 bypasses reads.
// ---------------------------------------------------------------------------
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const CACHE_DIR = path.join(ROOT, "data/raw/http-cache");
const CACHE_TTL_H = Number(process.env.MOSPI_CACHE_TTL_H ?? 20);
const NO_CACHE = process.env.MOSPI_NO_CACHE === "1";

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
// The host's rate limiter is what killed previous ingest runs.
// ---------------------------------------------------------------------------
const MIN_GAP_MS = Number(process.env.MOSPI_GAP_MS ?? 350);
let queue = Promise.resolve();
let lastRequestAt = 0;

function getJson(url) {
  // Raw request via net.mjs: hard 180s total deadline and 64MB cap on top of
  // the 60s idle timeout, so a slow-drip response can never hang an ingest.
  // Status/throttle classification (429/5xx/HTML-as-JSON, Retry-After) and
  // JSON validation happen inside net.mjs; the retry/backoff policy stays
  // here because its cadence is tuned to this host.
  return requestOnce(url, { agent, timeoutMs: 60_000, deadlineMs: 180_000 });
}

async function fetchWithRetry(url, retries) {
  let lastErr;
  for (let attempt = 1; attempt <= retries; attempt++) {
    const wait = Math.max(0, lastRequestAt + MIN_GAP_MS - Date.now());
    if (wait) await new Promise((r) => setTimeout(r, wait));
    lastRequestAt = Date.now();
    try {
      const json = await getJson(url);
      if (json.error) throw new Error(`${json.error} for ${url}`);
      return json;
    } catch (err) {
      lastErr = err;
      // fatal errors (4xx, size cap) will never succeed on retry — fail now
      // instead of burning ~2 minutes each across the remaining attempts
      if (err.fatal) throw err;
      if (attempt < retries) {
        // throttle signals back off much harder than transient errors
        const base = err.throttled ? 8000 * 2 ** (attempt - 1) : 1500 * attempt;
        const delay = err.retryAfter ? err.retryAfter * 1000 : Math.min(base, 120_000);
        process.stdout.write(`  retry ${attempt}/${retries - 1} in ${Math.round(delay / 1000)}s (${err.message.slice(0, 80)})\n`);
        await new Promise((r) => setTimeout(r, delay));
      }
    }
  }
  throw lastErr;
}

// Page size cap. Since about 2026-10 every eSankhyiki endpoint answers HTTP
// 400 to limit > 100 (checked live 2026-10-09 on cpialrl, plfs, iip, isp,
// mnre and wpi base 2022-23; the Data Bank saw the same cap on 2026-10-01).
// The cap is applied here, once, so no adapter can ask for more. Callers that
// read a single page must use mospiAll below, or they would silently get the
// first 100 rows only.
export const MOSPI_MAX_LIMIT = 100;

export async function mospi(apiPath, params = {}, retries = 6, { fresh = false } = {}) {
  if (params.limit != null && Number(params.limit) > MOSPI_MAX_LIMIT) params = { ...params, limit: MOSPI_MAX_LIMIT };
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) qs.set(k, String(v));
  const url = BASE + apiPath + "?" + qs.toString();
  const cached = fresh ? null : cacheRead(url);
  if (cached) return cached;
  const run = queue.then(() => fetchWithRetry(url, retries));
  queue = run.catch(() => {});
  const json = await run;
  cacheWrite(url, json);
  return json;
}

// Every row of one query, paged at the cap. Follows meta_data.totalPages and,
// where the endpoint reports totalRecords, fails unless the rows collected
// match it: a short read must never pass as a complete one. Endpoints without
// meta_data page until a short batch.
// One complete page set. `fresh` skips the cache (a re-read must reach the server).
async function collectPages(apiPath, params, limit, fresh) {
  const rows = [];
  let expected = null;
  for (let page = 1; ; page++) {
    const res = await mospi(apiPath, { ...params, page, limit }, 6, { fresh });
    const batch = res.data ?? [];
    rows.push(...batch);
    const meta = res.meta_data;
    if (meta?.totalRecords != null) expected = Number(meta.totalRecords);
    if (meta?.totalPages != null ? page >= Number(meta.totalPages) : batch.length < limit) break;
  }
  if (expected != null && rows.length !== expected) {
    throw new Error(`mospiAll ${apiPath} ${JSON.stringify(params)}: ${rows.length} rows collected, endpoint reports ${expected}`);
  }
  return rows;
}
const distinct = (rows) => { const m = new Map(); for (const r of rows) m.set(JSON.stringify(r), r); return m; };
const sameKeys = (a, b) => a.size === b.size && [...a.keys()].every((k) => b.has(k));
export const MOSPI_STABLE_LIMIT = 100;

/** Every row of an endpoint, across pages.
 *  The API pages without a stable order: a page set can repeat one row and drop another
 *  while the count still matches (AISHE 2021-22 teachers, our dump of 2026-08-09; found
 *  2026-10-10). Every data row is unique by its dimensions, so an identical row twice is a
 *  warning sign. When one appears, the set is read again from the server in small pages
 *  (100 rows, which pages stably). Same distinct rows both ways: the source itself repeats
 *  them, and the copies are dropped with a warning. Different rows: paging slipped, and the
 *  small-page read is checked against a second small-page read before it is trusted;
 *  otherwise the fetch fails loudly. */
export async function mospiAll(apiPath, params = {}) {
  const rows = await collectPages(apiPath, params, MOSPI_MAX_LIMIT, false);
  const big = distinct(rows);
  if (big.size === rows.length) return rows;
  const tag = `mospiAll ${apiPath} ${JSON.stringify(params)}`;
  const small = distinct(await collectPages(apiPath, params, MOSPI_STABLE_LIMIT, true));
  if (sameKeys(big, small)) {
    console.warn(`  warn: ${tag}: the source repeats ${rows.length - big.size} row(s) verbatim; copies dropped`);
    return [...big.values()];
  }
  const again = distinct(await collectPages(apiPath, params, MOSPI_STABLE_LIMIT, true));
  if (sameKeys(small, again)) {
    console.warn(`  warn: ${tag}: ${MOSPI_MAX_LIMIT}-row pages slipped (${big.size} distinct rows against ${small.size}); used ${MOSPI_STABLE_LIMIT}-row pages, read twice and identical`);
    return [...small.values()];
  }
  throw new Error(`${tag}: rows differ between page sizes and between two small-page reads (unstable paging); not baking it`);
}
