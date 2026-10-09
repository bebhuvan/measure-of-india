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
//
// The firewall (2026-10-09, worldbank session). api.worldbank.org sits behind a
// WAF that answers a burst of requests, a `source=` query parameter or a
// semicolon-joined indicator list with an HTML "5xx Error Page" served as 200,
// and then blocks the client IP for several minutes on every path, PIP
// included. Two consequences, both handled here:
//   - requests are spaced WB_GAP_MS apart (default 1500ms, not 350ms), and
//     never use `source=` or `;` (use /sources/<id>/indicators for catalogues
//     and one indicator per call);
//   - an HTML answer is a block, not an error: wait WB_BLOCK_WAIT_S (default
//     300s), widen the gap, and try again, up to WB_BLOCK_TRIES times.
// The PIP API (api.worldbank.org/pip/v1) shares the host and the WAF, so pip()
// rides the same queue and cache.

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
let gapMs = Number(process.env.WB_GAP_MS ?? 1500);
const BLOCK_WAIT_S = Number(process.env.WB_BLOCK_WAIT_S ?? 300);
const BLOCK_TRIES = Number(process.env.WB_BLOCK_TRIES ?? 6);
let queue = Promise.resolve();
let lastRequestAt = 0;

async function getPage(url) {
  const cached = cacheRead(url);
  if (cached) return cached;
  const run = queue.then(async () => {
    for (let block = 0; ; block++) {
      const wait = Math.max(0, lastRequestAt + gapMs - Date.now());
      if (wait) await new Promise((r) => setTimeout(r, wait));
      lastRequestAt = Date.now();
      try {
        return await getJson(url, { gapMs: 0, retries: 2 });
      } catch (e) {
        // an HTML page where JSON was asked for is the WAF's block page
        if (!/Non-JSON response/.test(e.message) || block + 1 >= BLOCK_TRIES) throw e;
        gapMs = Math.min(gapMs * 2, 10_000);
        console.warn(`  world bank: firewall block on ${url.replace(/^https:\/\/api\.worldbank\.org/, "")}; waiting ${BLOCK_WAIT_S}s, gap now ${gapMs}ms (${block + 1}/${BLOCK_TRIES})`);
        await new Promise((r) => setTimeout(r, BLOCK_WAIT_S * 1000));
      }
    }
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
  // the envelope's database stamp and source id ride along as array properties
  // (JSON.stringify ignores them, so callers that archive rows are unaffected)
  const tag = (arr) => Object.assign(arr, { lastupdated: meta.lastupdated ?? null, sourceid: meta.sourceid ?? null });
  if (!Array.isArray(rows)) return tag([]); // valid "no data" envelope: rows is null
  const out = [...rows];
  for (let page = 2; page <= (meta.pages ?? 1); page++) {
    const [, more] = await getPage(pageUrl(page));
    if (Array.isArray(more)) out.push(...more);
  }
  return tag(out);
}

// The Poverty and Inequality Platform API (api.worldbank.org/pip/v1). Plain JSON
// arrays, no envelope; an empty array is a valid "no data". `path` is the
// endpoint ("pip", "aux", "versions"); params are passed as given (no `source`).
const PIP_BASE = "https://api.worldbank.org/pip/v1/";
export async function pip(apiPath, params = {}) {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries({ ...params, format: "json" })) qs.set(k, String(v));
  const json = await getPage(`${PIP_BASE}${apiPath}?${qs.toString()}`);
  if (json && !Array.isArray(json) && json.error) throw new Error(`PIP API error for ${apiPath}: ${JSON.stringify(json.error).slice(0, 300)}`);
  return json;
}

// ---------------------------------------------------------------------------
// The per-country bulk file. https://api.worldbank.org/v2/en/country/<ISO3>?
// downloadformat=csv returns a small zip (about 600 KB for India) holding every
// WDI indicator for that country as one CSV, plus indicator metadata (name,
// source note, source organisation). One request instead of 1,500 indicator
// calls, which the host's firewall and latency make impractical (2026-10-09:
// 20 s per call). Returns { files: { name: utf8 text }, bytes, sha256, name }.
import zlib from "node:zlib";
import { getBuffer } from "./net.mjs";

function unzip(buf) {
  // read the central directory (end record within the last 64 KB), then inflate
  // each member; zip64 and encryption are refused loudly
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65557); i--) if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  if (eocd < 0) throw new Error("world bank zip: no end-of-central-directory record");
  const n = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  const files = {};
  for (let k = 0; k < n; k++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) throw new Error("world bank zip: bad central directory entry");
    const method = buf.readUInt16LE(p + 10), csize = buf.readUInt32LE(p + 20);
    const nameLen = buf.readUInt16LE(p + 28), extraLen = buf.readUInt16LE(p + 30), commentLen = buf.readUInt16LE(p + 32);
    const local = buf.readUInt32LE(p + 42);
    const name = buf.toString("utf8", p + 46, p + 46 + nameLen);
    if (csize === 0xffffffff || local === 0xffffffff) throw new Error(`world bank zip: ${name} is zip64, not supported`);
    const lNameLen = buf.readUInt16LE(local + 26), lExtraLen = buf.readUInt16LE(local + 28);
    const data = buf.subarray(local + 30 + lNameLen + lExtraLen, local + 30 + lNameLen + lExtraLen + csize);
    if (method === 0) files[name] = data.toString("utf8");
    else if (method === 8) files[name] = zlib.inflateRawSync(data).toString("utf8");
    else throw new Error(`world bank zip: ${name} uses compression method ${method}`);
    p += 46 + nameLen + extraLen + commentLen;
  }
  return files;
}

export async function wbCountryZip(iso3) {
  const url = `https://api.worldbank.org/v2/en/country/${iso3}?downloadformat=csv`;
  const buf = await getBuffer(url, { maxBytes: 64 * 1024 * 1024 });
  if (buf.subarray(0, 2).toString() !== "PK") throw new Error(`world bank: ${url} did not return a zip (firewall block page?)`);
  return { files: unzip(buf), bytes: buf.length, sha256: crypto.createHash("sha256").update(buf).digest("hex"), url };
}
