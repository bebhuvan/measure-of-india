// scripts/lib/nhb.mjs: the family client for the National Housing Bank's RESIDEX dashboards.
//
// RESIDEX answers form POSTs (application/x-www-form-urlencoded) with a JSON envelope
// { status: "Success" | "Error", data: "<JSON string>" }. net.mjs is GET-only, so this file
// carries a small POST with the same discipline: a hard total deadline, a size cap, retries
// with backoff that back off harder on 429/5xx, and one request at a time with a fixed gap.
// (A generic POST belongs in net.mjs; left here so parallel family branches don't collide.
// Flagged for the coordinator in docs/status/bis.md.)
//
// Optional development cache: set INDIA_ATLAS_RESIDEX_CACHE to a directory outside the repo and
// responses are kept there by request, so a re-run does not hit NHB again. Without it every
// run fetches live. The audit trail is the adapter's raw archive (data/raw/housing-residex.json).
import https from "node:https";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

export const NHB = "https://residex.nhbonline.org.in";
const GAP_MS = 1500;
let lastAt = 0;
const agent = new https.Agent({ keepAlive: true, maxSockets: 1 });

function postOnce(url, form, { deadlineMs = 120_000, maxBytes = 32 * 1024 * 1024 } = {}) {
  const body = new URLSearchParams(form).toString();
  return new Promise((resolve, reject) => {
    let out = "", bytes = 0, done = false;
    const finish = (fn, v) => { if (!done) { done = true; req.destroy(); fn(v); } };
    const req = https.request(url, { method: "POST", agent, headers: { "content-type": "application/x-www-form-urlencoded; charset=UTF-8", "content-length": Buffer.byteLength(body), "x-requested-with": "XMLHttpRequest" } }, (res) => {
      res.setEncoding("utf8");
      res.on("data", (c) => { out += c; bytes += Buffer.byteLength(c); if (bytes > maxBytes) finish(reject, Object.assign(new Error(`nhb: response over ${maxBytes} bytes for ${url}`), { fatal: true })); });
      res.on("end", () => {
        if (res.statusCode === 429 || res.statusCode >= 500) return finish(reject, Object.assign(new Error(`nhb: HTTP ${res.statusCode} for ${url}`), { throttled: true }));
        if (res.statusCode !== 200) return finish(reject, Object.assign(new Error(`nhb: HTTP ${res.statusCode} for ${url}`), { fatal: true }));
        try { finish(resolve, JSON.parse(out)); } catch (e) { finish(reject, Object.assign(new Error(`nhb: bad JSON from ${url}: ${out.slice(0, 120)}`), { throttled: true })); }
      });
    });
    req.setTimeout(60_000, () => finish(reject, new Error(`nhb: idle timeout for ${url}`)));
    setTimeout(() => finish(reject, new Error(`nhb: total deadline exceeded for ${url}`)), deadlineMs).unref?.();
    req.on("error", (e) => finish(reject, e));
    req.end(body);
  });
}

/** POST a RESIDEX endpoint; returns the parsed `data` array ([] when NHB answers status "Error"). */
const CACHE = process.env.INDIA_ATLAS_RESIDEX_CACHE || null;
export async function nhbPost(endpoint, form) {
  const id = crypto.createHash("sha1").update(endpoint + "?" + new URLSearchParams(form).toString()).digest("hex").slice(0, 16);
  const cacheFile = CACHE && path.join(CACHE, `${endpoint.replace(/\//g, "_")}-${id}.json`);
  if (cacheFile && fs.existsSync(cacheFile)) return JSON.parse(fs.readFileSync(cacheFile, "utf8")).data;
  let lastErr;
  for (let attempt = 1; attempt <= 5; attempt++) {
    const wait = lastAt + GAP_MS - Date.now();
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    lastAt = Date.now();
    try {
      const j = await postOnce(`${NHB}/${endpoint}`, form);
      const data = j.status === "Success" && j.data ? JSON.parse(j.data) : [];
      if (cacheFile) { fs.mkdirSync(CACHE, { recursive: true }); fs.writeFileSync(cacheFile, JSON.stringify({ endpoint, form, status: j.status, data }) + "\n"); }
      return data;
    } catch (e) {
      lastErr = e;
      if (e.fatal) break;
      await new Promise((r) => setTimeout(r, (e.throttled ? 8000 : 2000) * attempt));
    }
  }
  throw lastErr;
}

/** GET a RESIDEX JSON utility endpoint (city list). */
export async function nhbGet(endpoint) {
  const cacheFile = CACHE && path.join(CACHE, `${endpoint.replace(/\//g, "_")}.json`);
  if (cacheFile && fs.existsSync(cacheFile)) return JSON.parse(fs.readFileSync(cacheFile, "utf8")).data;
  const { getJson } = await import("./net.mjs");
  const data = await getJson(`${NHB}/${endpoint}`, { gapMs: GAP_MS });
  if (cacheFile) { fs.mkdirSync(CACHE, { recursive: true }); fs.writeFileSync(cacheFile, JSON.stringify({ endpoint, data }) + "\n"); }
  return data;
}
