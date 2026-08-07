import https from "node:https";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

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
  return new Promise((resolve, reject) => {
    const req = https.get(url, { agent, timeout: 60000 }, (res) => {
      let body = "";
      res.setEncoding("utf8");
      res.on("data", (c) => (body += c));
      res.on("end", () => {
        if (res.statusCode === 429 || res.statusCode >= 500) {
          const err = new Error(`HTTP ${res.statusCode} for ${url}`);
          err.throttled = true;
          err.retryAfter = Number(res.headers["retry-after"]) || null;
          return reject(err);
        }
        if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode} for ${url}`));
        if (body.trimStart().startsWith("<")) {
          // HTML instead of JSON is how this host says "slow down"
          const err = new Error(`Non-JSON response for ${url}`);
          err.throttled = true;
          return reject(err);
        }
        try {
          resolve(JSON.parse(body));
        } catch (e) {
          reject(new Error(`Bad JSON from ${url}: ${e.message}`));
        }
      });
    });
    req.on("timeout", () => req.destroy(new Error(`Timeout for ${url}`)));
    req.on("error", reject);
  });
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
