// scripts/lib/net.mjs — the canonical HTTP client for every product adapter.
//
// Contract (docs/RUNBOOK-sources.md §network):
//   - hard total deadline per request (default 120s) — a slow-drip socket can
//     never hang a release past the workflow timeout
//   - response size cap (default 64 MB) — unbounded bodies cannot balloon memory
//   - retry with backoff; throttle-aware (429/5xx/HTML-in-JSON honour Retry-After
//     and back off exponentially)
//   - JSON parse validation before anything downstream sees the body
//   - optional per-host keep-alive agent (e.g. legacy TLS for api.mospi.gov.in)
//
// Usage:
//   import { getJson, getText } from "../lib/net.mjs";
//   const rows = await getJson(url, { agent, gapMs: 350, retries: 6 });
//   const csv  = await getText(url, { gapMs: 350 });   // CSV/text sources (OWID)
//
// Throttling/queueing is intentionally per-call (`gapMs`) so products that hit
// polite hosts don't inherit a MoSPI-sized gap. If you need a global
// single-flight queue like mospi.mjs, wrap getJson the way mospi.mjs does.

import http from "node:http";
import https from "node:https";

const agents = new Map(); // origin+agentOpts -> shared keep-alive agent

function agentFor(url, opts = {}) {
  if (opts.agent) return opts.agent; // caller-supplied (legacy TLS etc.)
  const origin = new URL(url).origin;
  const key = origin + JSON.stringify(opts.agentOptions ?? {});
  if (!agents.has(key)) {
    const Ctor = origin.startsWith("https:") ? https.Agent : http.Agent;
    agents.set(key, new Ctor({ keepAlive: true, maxSockets: 4, ...opts.agentOptions }));
  }
  return agents.get(key);
}

// One attempt. Classifies failures so the retry loop can back off harder on
// throttle signals. Never resolves with an unparsed body (unless asText).
// Follows up to 3 redirects (http→https moves and CDN hops are ordinary);
// each hop gets a fresh deadline.
const REDIRECT_STATUS = new Set([301, 302, 303, 307, 308]);
// `markup: true` accepts a body that starts with "<" (XML listings such as S3's); by default
// such a body is read as a throttling gateway's HTML page. `encoding: "latin1"` keeps every
// byte of a binary body (an xlsx) one-to-one in the string: Buffer.from(body, "latin1").
export function requestOnce(url, { agent, timeoutMs = 60_000, deadlineMs = 120_000, maxBytes = 64 * 1024 * 1024, asText = false, redirectsLeft = 3, markup = false, encoding = "utf8" } = {}) {
  return new Promise((resolve, reject) => {
    const started = Date.now();
    let body = "";
    let bytes = 0;
    let settled = false;
    const finish = (fn, arg) => { if (!settled) { settled = true; req.destroy(); fn(arg); } };

    const req = (url.startsWith("http:") ? http : https).get(url, { agent: agentFor(url, { agent }) }, (res) => {
      res.setEncoding(encoding);
      if (REDIRECT_STATUS.has(res.statusCode) && res.headers.location && redirectsLeft > 0) {
        const next = new URL(res.headers.location, url).toString();
        return finish(resolve, requestOnce(next, { agent, timeoutMs, deadlineMs, maxBytes, asText, redirectsLeft: redirectsLeft - 1, markup, encoding }));
      }
      res.on("data", (c) => {
        body += c;
        bytes += Buffer.byteLength(c); // the cap is bytes, not UTF-16 code units
        if (bytes > maxBytes) {
          const err = new Error(`Response exceeds ${maxBytes} bytes for ${url}`);
          err.fatal = true; // retrying an oversized body is pointless
          finish(reject, err);
        }
        if (Date.now() - started > deadlineMs) {
          const err = new Error(`Total deadline (${deadlineMs}ms) exceeded for ${url}`);
          finish(reject, err);
        }
      });
      res.on("end", () => {
        const status = res.statusCode;
        if (status === 429 || status >= 500) {
          const err = new Error(`HTTP ${status} for ${url}`);
          err.throttled = true;
          err.retryAfter = Number(res.headers["retry-after"]) || null;
          return finish(reject, err);
        }
        if (status !== 200) {
          const err = new Error(`HTTP ${status} for ${url}`);
          err.fatal = status >= 400 && status < 500 && status !== 429; // 4xx (except 429) will not heal
          return finish(reject, err);
        }
        // `markup: true` is for sources whose real payload is XML (S3 listings, SDMX
        // structure messages); everyone else keeps the throttle-page guard.
        if (!markup && body.trimStart().startsWith("<")) {
          // an HTML error/login page served with 200 is how throttling gateways behave
          const err = new Error(`Non-JSON response for ${url}`);
          err.throttled = true;
          return finish(reject, err);
        }
        if (asText) return finish(resolve, body);
        try {
          finish(resolve, JSON.parse(body));
        } catch (e) {
          const err = new Error(`Bad JSON from ${url}: ${e.message}`);
          err.throttled = true; // truncated bodies under load — one retry is cheap
          finish(reject, err);
        }
      });
    });
    req.setTimeout(timeoutMs, () => finish(reject, new Error(`Idle timeout (${timeoutMs}ms) for ${url}`)));
    // absolute deadline even if the socket never idles (slow-drip)
    setTimeout(() => finish(reject, new Error(`Total deadline (${deadlineMs}ms) exceeded for ${url}`)), deadlineMs).unref?.();
    req.on("error", (e) => finish(reject, e));
  });
}

async function get(url, opts, asText) {
  const { retries = 4, gapMs = 0, onRetry } = opts;
  let lastErr;
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const json = await requestOnce(url, { ...opts, asText });
      if (!asText && json && json.error) throw Object.assign(new Error(`${json.error} for ${url}`), { fatal: true });
      return json;
    } catch (err) {
      lastErr = err;
      if (err.fatal || attempt === retries) break;
      // throttle signals back off much harder than transient errors
      const base = err.throttled ? 8000 * 2 ** (attempt - 1) : 1500 * attempt;
      const delay = err.retryAfter ? err.retryAfter * 1000 : Math.min(base, 120_000);
      onRetry?.(attempt, delay, err);
      await new Promise((r) => setTimeout(r, delay + gapMs));
    }
  }
  throw lastErr;
}

export function getJson(url, opts = {}) {
  return get(url, opts, false);
}

// Same deadline/size-cap/retry/throttle discipline as getJson, but resolves
// with the raw body string — for CSV and other non-JSON sources (OWID).
export function getText(url, opts = {}) {
  return get(url, opts, true);
}

// ---------------------------------------------------------------------------
// getBuffer: binary bodies (gzip CSV dumps such as UN WPP), with the same
// deadline, size cap, redirect and retry/throttle discipline as getJson.
// Added 2026-10-09 by the worldbank family session (UN WPP adapter); kept as a
// separate self-contained function so the text path above is untouched.
function bufferOnce(url, { timeoutMs = 60_000, deadlineMs = 600_000, maxBytes = 256 * 1024 * 1024, redirectsLeft = 3 } = {}) {
  return new Promise((resolve, reject) => {
    const started = Date.now();
    const chunks = [];
    let bytes = 0, settled = false;
    const finish = (fn, arg) => { if (!settled) { settled = true; req.destroy(); fn(arg); } };
    const req = (url.startsWith("http:") ? http : https).get(url, { agent: agentFor(url) }, (res) => {
      if (REDIRECT_STATUS.has(res.statusCode) && res.headers.location && redirectsLeft > 0) {
        return finish(resolve, bufferOnce(new URL(res.headers.location, url).toString(), { timeoutMs, deadlineMs, maxBytes, redirectsLeft: redirectsLeft - 1 }));
      }
      res.on("data", (c) => {
        chunks.push(c);
        bytes += c.length;
        if (bytes > maxBytes) finish(reject, Object.assign(new Error(`Response exceeds ${maxBytes} bytes for ${url}`), { fatal: true }));
        if (Date.now() - started > deadlineMs) finish(reject, new Error(`Total deadline (${deadlineMs}ms) exceeded for ${url}`));
      });
      res.on("end", () => {
        const status = res.statusCode;
        if (status === 429 || status >= 500) return finish(reject, Object.assign(new Error(`HTTP ${status} for ${url}`), { throttled: true, retryAfter: Number(res.headers["retry-after"]) || null }));
        if (status !== 200) return finish(reject, Object.assign(new Error(`HTTP ${status} for ${url}`), { fatal: status >= 400 && status < 500 }));
        finish(resolve, Buffer.concat(chunks));
      });
    });
    req.setTimeout(timeoutMs, () => finish(reject, new Error(`Idle timeout (${timeoutMs}ms) for ${url}`)));
    setTimeout(() => finish(reject, new Error(`Total deadline (${deadlineMs}ms) exceeded for ${url}`)), deadlineMs).unref?.();
    req.on("error", (e) => finish(reject, e));
  });
}

export async function getBuffer(url, opts = {}) {
  const { retries = 4, onRetry } = opts;
  let lastErr;
  for (let attempt = 1; attempt <= retries; attempt++) {
    try { return await bufferOnce(url, opts); } catch (err) {
      lastErr = err;
      if (err.fatal || attempt === retries) break;
      const delay = err.retryAfter ? err.retryAfter * 1000 : Math.min((err.throttled ? 8000 * 2 ** (attempt - 1) : 1500 * attempt), 120_000);
      onRetry?.(attempt, delay, err);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw lastErr;
}
