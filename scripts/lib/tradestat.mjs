// scripts/lib/tradestat.mjs: the family client for TradeStat, the Department of Commerce's
// public front end to DGCI&S customs data (https://tradestat.commerce.gov.in/). Transport for
// dossiers with `family: tradestat` in data/sources.yml; the adapter is
// scripts/lib/products/tradestat.mjs. Notes on the site: docs/reference/tradestat.md.
//
// There is no API. Every view is a Laravel form:
//   1. GET the form page: it sets a session cookie and embeds a CSRF `_token`;
//   2. POST the same URL with the token, the cookie and the form fields (urlencoded);
//   3. the answer is a whole HTML page with the data in its first large <table>.
// A token is single-use in practice (a POST after a failed POST answers 419), so every
// attempt fetches a fresh form first. One request in flight at a time, with a polite gap.
//
// Traps this client guards against (each one seen live, 2026-10-09):
//   - an unpublished month is answered with HTTP 200 and a full table of 0.00 values flagged
//     "(A)" (the same-month-last-year column is filled): the caller must treat a column whose
//     cells are all zero as "not published", never as zero trade (`allZero(rows, col)`);
//   - the page also carries a JavaScript row template table ("' + item.HSCODE + '"): the data
//     table is the largest table on the page, never the first by position;
//   - growth columns print "-" where growth cannot be computed; values never do.

import { requestRaw } from "./net.mjs";

export const BASE = "https://tradestat.commerce.gov.in/";
const UA = "IndiaAtlas/1.0 (+https://atlas.thisindianlife.today; public-data reference work)";
const GAP_MS = Number(process.env.TRADESTAT_GAP_MS ?? 600);
const RETRIES = 6;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let chain = Promise.resolve();           // single-flight queue: one request at a time
let lastEnd = 0;
export const stats = { requests: 0, retries: 0, bytes: 0 };

const ENT = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", "#39": "'" };
export function decode(s) {
  return String(s)
    .replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => {
      if (e[0] === "#") return String.fromCodePoint(e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : +e.slice(1));
      return ENT[e.toLowerCase()] ?? m;
    });
}
const cellText = (h) => decode(h.replace(/<br\s*\/?>/gi, " ").replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();

/** Every <table> on the page as rows of cell strings (th and td alike). */
export function parseTables(html) {
  const out = [];
  for (const t of html.match(/<table[\s\S]*?<\/table>/gi) ?? []) {
    const rows = [];
    for (const r of t.match(/<tr[\s\S]*?<\/tr>/gi) ?? []) {
      const cells = [...r.matchAll(/<t[hd]\b[^>]*>([\s\S]*?)<\/t[hd]>/gi)].map((m) => cellText(m[1]));
      if (cells.length) rows.push(cells);
    }
    out.push(rows);
  }
  return out;
}

/** The page's own footnotes: report date, value unit, flag legend, HS-change notes. */
export function pageNotes(html) {
  const text = decode(html.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ");
  const grab = (re) => (text.match(re) ?? [null])[0]?.trim() ?? null;
  return {
    reportDated: grab(/Report Dated:?\s*[A-Za-z]{0,3},?\s*[A-Za-z]{3} \d{1,2}, \d{4}|Report Dated:?\s*\d{1,2} [A-Za-z]{3} \d{4}/),
    values: grab(/Values in [A-Za-z$₹. ]+?(?=\s*\|\||\s*$|\s{2})/),
    flags: [...new Set(text.match(/\([A-Z]\) (?:Revised Final|Final|Provisional|Revised|Advance|Estimated)/g) ?? [])],
    hsNotes: [...new Set((text.match(/\* ?(?:ITC HS Code|represents that)[^*|]{10,160}/g) ?? []).map((s) => s.replace(/\s*(Report Dated|Close|Data Source).*$/, "").trim()))],
  };
}

async function once(view, fields) {
  const url = BASE + view;
  const g = await requestRaw(url, { headers: { "User-Agent": UA, Accept: "text/html" } });
  if (g.status !== 200) throw Object.assign(new Error(`TradeStat ${view}: form GET answered HTTP ${g.status}`), { retry: g.status === 429 || g.status >= 500 });
  const token = g.body.match(/name="_token"\s+value="([^"]+)"/)?.[1];
  if (!token) throw Object.assign(new Error(`TradeStat ${view}: no CSRF token on the form page`), { retry: true });
  const cookie = [].concat(g.headers["set-cookie"] ?? []).map((c) => c.split(";")[0]).join("; ");
  const body = new URLSearchParams({ _token: token, ...fields }).toString();
  const p = await requestRaw(url, { method: "POST", body, headers: {
    "User-Agent": UA, Accept: "text/html", Cookie: cookie, Referer: url, "Content-Type": "application/x-www-form-urlencoded" } });
  stats.bytes += g.body.length + p.body.length;
  if (p.status !== 200) throw Object.assign(new Error(`TradeStat ${view}: POST answered HTTP ${p.status}`), { retry: p.status === 419 || p.status === 429 || p.status >= 500 });
  return p.body;
}

/** POST one TradeStat form and return its data table.
 *  -> { view, fields, header: string[][], rows: string[][], notes }
 *  `header` is the leading rows with no numeric cell; `rows` the rest, cells as printed. */
export function tsQuery(view, fields) {
  const run = async () => {
    const wait = lastEnd + GAP_MS - Date.now();
    if (wait > 0) await sleep(wait);
    let lastErr;
    try {
      for (let attempt = 1; attempt <= RETRIES; attempt++) {
        try {
          stats.requests++;
          const html = await once(view, fields);
          const tables = parseTables(html);
          const t = tables.sort((a, b) => b.length - a.length)[0] ?? [];
          if (/item\.HSCODE/.test(JSON.stringify(t))) throw new Error(`TradeStat ${view}: only the row template table came back`);
          const isNum = (c) => /^-?[\d,]+(\.\d+)?$/.test(c);
          let h = 0;
          while (h < t.length && !t[h].some(isNum)) h++;
          const header = t.slice(0, h), rows = t.slice(h);
          return { view, fields, header, rows, notes: pageNotes(html) };
        } catch (e) {
          lastErr = e;
          const transient = e.retry !== false && !e.fatal;
          if (!transient || attempt === RETRIES) break;
          stats.retries++;
          const delay = Math.min(4000 * 2 ** (attempt - 1), 120_000);
          console.warn(`  tradestat retry ${attempt}/${RETRIES - 1} in ${delay / 1000}s: ${e.message}`);
          await sleep(delay);
        }
      }
      throw lastErr;
    } finally {
      lastEnd = Date.now();
    }
  };
  const p = chain.then(run, run);
  chain = p.catch(() => {});
  return p;
}

/** True when every cell of column `col` is zero or blank: an unpublished period. */
export const allZero = (rows, col) => rows.every((r) => { const c = (r[col] ?? "").replace(/,/g, ""); return c === "" || c === "-" || +c === 0; });
