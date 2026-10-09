// scripts/lib/ilostat.mjs: the ILOSTAT family client (ILO's SDMX 2.1 REST API at
// sdmx.ilo.org). Transport for dossiers with `family: ilostat` in data/sources.yml; used by
// scripts/lib/products/ilostat.mjs, which never hand-rolls HTTP. Reverse-engineering notes:
// docs/reference/ilostat.md.
//
// Three calls, all GET:
//   dataflows()            every ILOSTAT dataflow (id, English name, DSD id, last update)
//   constraint(flowId)     the flow's "Actual" content constraint: its dimension order and the
//                          codes present in each dimension across ALL countries (so it says
//                          whether India is in the flow at all, never which cuts India has)
//   data(flowId, nDims)    every observation for India: { dims, rows }, rows as objects keyed
//                          by SDMX-CSV column. Key "IND" + one empty slot per other dimension.
//
// Quirks that shape this file:
//   - rplumber.ilo.org (the older bulk/R endpoint) answers 200 with an empty body for every
//     query as of 2026-10-09; SDMX is the only working machine interface.
//   - A data query for a country the flow does not hold returns HTTP 500 (an Oracle
//     ORA-00936), not 404. net.mjs would read that as throttling and retry; so data() is only
//     ever called for flows whose constraint lists IND.
//   - Structure messages are XML only (format= is ignored for structures, and the SDMX 2.1
//     availableconstraint and every v2 endpoint return "not implemented"). They go through
//     net.mjs getText with `markup: true`.
//   - `format=csvfile` gives SDMX-CSV 1.0 (codes only); labels come from the codelists, which
//     the catalogue generator reads separately (codelist()).
//
// Politeness: one request in flight, ILO_GAP_MS (default 400ms) apart. Every response is
// cached at data/raw/http-cache/<sha1(url)>.json (git-ignored) for ILO_CACHE_TTL_H hours
// (default 20), so an interrupted run resumes; ILO_NO_CACHE=1 bypasses reads.

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { getText } from "./net.mjs";
import { parseCsv } from "./tabular.mjs";

export const BASE = "https://sdmx.ilo.org/rest/";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const CACHE_DIR = path.join(ROOT, "data/raw/http-cache");
const CACHE_TTL_H = Number(process.env.ILO_CACHE_TTL_H ?? 20);
const NO_CACHE = process.env.ILO_NO_CACHE === "1";
const MIN_GAP_MS = Number(process.env.ILO_GAP_MS ?? 400);

const cachePath = (url) => path.join(CACHE_DIR, crypto.createHash("sha1").update(url).digest("hex") + ".json");
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

let queue = Promise.resolve();
let lastRequestAt = 0;
export let requests = 0;
async function get(url, { markup = false } = {}) {
  const cached = cacheRead(url);
  if (cached != null) return cached;
  const run = queue.then(async () => {
    const wait = Math.max(0, lastRequestAt + MIN_GAP_MS - Date.now());
    if (wait) await new Promise((r) => setTimeout(r, wait));
    lastRequestAt = Date.now();
    requests++;
    // Cloudflare in front of sdmx.ilo.org now and then answers 403 to a request it serves a
    // minute later; net.mjs treats 4xx as final, so 403 alone gets two slow retries here
    for (let attempt = 1; ; attempt++) {
      try {
        return await getText(url, { markup, retries: 5, deadlineMs: 300_000, timeoutMs: 120_000 });
      } catch (e) {
        if (!/HTTP 403/.test(e.message) || attempt >= 3) throw e;
        await new Promise((r) => setTimeout(r, 30_000 * attempt));
        lastRequestAt = Date.now();
      }
    }
  });
  queue = run.catch(() => {});
  const body = await run;
  cacheWrite(url, body);
  return body;
}

const unxml = (s) => s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&");
const tag = (block, re) => { const m = block.match(re); return m ? unxml(m[1]).trim() : null; };

/** Every dataflow: [{ id, name, dsd, lastUpdate }]. */
export async function dataflows() {
  const xml = await get(`${BASE}dataflow/ILO/all/latest`, { markup: true });
  const out = [];
  for (const m of xml.matchAll(/<structure:Dataflow id="([^"]+)"[\s\S]*?<\/structure:Dataflow>/g)) {
    const b = m[0];
    out.push({
      id: m[1],
      name: tag(b, /<common:Name xml:lang="en">([\s\S]*?)<\/common:Name>/),
      dsd: tag(b, /<structure:Structure>\s*<Ref id="([^"]+)"/),
      lastUpdate: tag(b, /<common:AnnotationTitle>([^<]*)<\/common:AnnotationTitle>\s*<common:AnnotationType>LAST_UPDATE/),
    });
  }
  if (out.length < 500) throw new Error(`ilostat: only ${out.length} dataflows listed (anchor: expected ~1,200)`);
  return out;
}

/** The flow's actual content constraint: { dims: [id...], values: { DIM: Set(codes) } }. */
export async function constraint(flowId) {
  const xml = await get(`${BASE}contentconstraint/ILO/CCA_${flowId}/latest`, { markup: true });
  const dims = [], values = {};
  for (const m of xml.matchAll(/<common:KeyValue id="([^"]+)">([\s\S]*?)<\/common:KeyValue>/g)) {
    if (m[1] === "TIME_PERIOD") continue;
    dims.push(m[1]);
    values[m[1]] = new Set([...m[2].matchAll(/<common:Value>([^<]*)<\/common:Value>/g)].map((v) => v[1]));
  }
  if (!dims.length || dims[0] !== "REF_AREA") throw new Error(`ilostat: constraint for ${flowId} has no REF_AREA-first key (${dims.join(",")})`);
  return { dims, values };
}

/** A codelist: Map(code -> { name, order, isTotal }) in English, with the ILO's display order. */
export async function codelist(id) {
  const xml = await get(`${BASE}codelist/ILO/${id}/latest`, { markup: true });
  const out = new Map();
  for (const m of xml.matchAll(/<structure:Code id="([^"]+)"[\s\S]*?<\/structure:Code>/g)) {
    const ann = (type) => tag(m[0], new RegExp(`<common:AnnotationTitle>([^<]*)<\\/common:AnnotationTitle>\\s*<common:AnnotationType>${type}<`));
    out.set(m[1], { name: tag(m[0], /<common:Name xml:lang="en">([\s\S]*?)<\/common:Name>/), order: Number(ann("ORDER") ?? 1e9), isTotal: ann("IS_TOTAL") === "Y" });
  }
  if (!out.size) throw new Error(`ilostat: codelist ${id} is empty`);
  return out;
}

/** Every observation of `area` in a flow: { dims, rows } with rows keyed by SDMX-CSV column.
 *  `nDims` comes from the content constraint, which can omit a dimension whose codes it does
 *  not constrain (DF_LAP_2LID_QTL_RT has no DCL in its constraint): the server then answers
 *  422 "Not enough key values", and we retry with one more empty slot, up to two. */
export async function data(flowId, nDims, area = "IND") {
  let lastErr;
  for (let n = nDims; n <= nDims + 2; n++) {
    const key = [area, ...Array(n - 1).fill("")].join(".");
    let csv;
    try {
      csv = await get(`${BASE}data/ILO,${flowId},1.0/${key}?format=csvfile`);
    } catch (e) {
      lastErr = e;
      if (/HTTP 422/.test(e.message)) continue;
      throw e;
    }
    const rows = parseCsv(csv, ",").filter((r) => r.length > 1);
    if (!rows.length) return { dims: [], rows: [] };
    const [head, ...body] = rows;
    const dims = head.slice(head.indexOf("REF_AREA"), head.indexOf("TIME_PERIOD"));
    return { dims, rows: body.map((r) => Object.fromEntries(head.map((h, i) => [h, r[i] ?? ""]))) };
  }
  throw lastErr;
}
