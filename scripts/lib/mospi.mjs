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

export async function mospi(apiPath, params = {}, retries = 6) {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) qs.set(k, String(v));
  const url = BASE + apiPath + "?" + qs.toString();
  const cached = cacheRead(url);
  if (cached) return cached;
  const run = queue.then(() => fetchWithRetry(url, retries));
  queue = run.catch(() => {});
  const json = await run;
  cacheWrite(url, json);
  return json;
}
