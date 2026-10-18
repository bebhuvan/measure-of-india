// scripts/indexnow.mjs: tell IndexNow search engines (Bing, Yandex, Seznam, Naver; shared between
// them) which pages a deploy changed, so a new print is crawled within hours rather than days.
// Google does not take IndexNow; it reads the sitemap's lastmod.
//
// deploy.yml runs it twice, only when the repository secret INDEXNOW_KEY is set:
//   node scripts/indexnow.mjs prepare [dist]   before `wrangler deploy`: writes the key file
//       (/<key>.txt, which proves the host is ours) into dist, and lists the pages whose sitemap
//       lastmod differs from the live site's (new pages included) in $RUNNER_TEMP/indexnow.json
//   node scripts/indexnow.mjs submit           after the deploy: sends that list, 10,000 at a time
// The key is read from the environment and never printed. A failed submission warns and exits 0:
// a ping must never fail a deploy that has already happened.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { SITE } from "../src/site.js";

const [cmd, distArg] = process.argv.slice(2);
const KEY = process.env.INDEXNOW_KEY ?? "";
const LIST = path.join(process.env.RUNNER_TEMP ?? os.tmpdir(), "indexnow.json");
if (!KEY) { console.log("indexnow: INDEXNOW_KEY not set, skipped"); process.exit(0); }
if (!/^[A-Za-z0-9-]{8,128}$/.test(KEY)) { console.error("indexnow: INDEXNOW_KEY must be 8 to 128 letters, digits or dashes"); process.exit(1); }

// { url: lastmod } from a sitemap index and its parts, read by `get`
async function sitemap(get) {
  const out = new Map();
  const index = await get("/sitemap-index.xml");
  if (!index) return out;
  for (const m of index.matchAll(/<loc>([^<]+)<\/loc>/g)) {
    const body = await get(new URL(m[1]).pathname);
    for (const u of body?.matchAll(/<url>([\s\S]*?)<\/url>/g) ?? [])
      out.set(u[1].match(/<loc>([^<]+)<\/loc>/)[1], u[1].match(/<lastmod>([^<]+)<\/lastmod>/)?.[1] ?? "");
  }
  return out;
}

if (cmd === "prepare") {
  const dist = path.resolve(distArg ?? "dist");
  fs.writeFileSync(path.join(dist, `${KEY}.txt`), KEY);
  const next = await sitemap(async (p) => fs.readFileSync(path.join(dist, p), "utf8"));
  const live = await sitemap(async (p) => {
    try { const r = await fetch(SITE.url + p, { signal: AbortSignal.timeout(20000) }); return r.ok ? await r.text() : null; } catch { return null; }
  });
  // with no live sitemap to compare (a first deploy), only the pages that carry a data vintage go
  const changed = [...next].filter(([u, lm]) => live.size ? live.get(u) !== lm : Boolean(lm)).map(([u]) => u);
  fs.writeFileSync(LIST, JSON.stringify(changed));
  console.log(`indexnow: key file written; ${changed.length} changed pages of ${next.size} queued`);
} else if (cmd === "submit") {
  const urls = fs.existsSync(LIST) ? JSON.parse(fs.readFileSync(LIST, "utf8")) : [];
  for (let i = 0; i < urls.length; i += 10000) {
    const batch = urls.slice(i, i + 10000);
    try {
      const r = await fetch("https://api.indexnow.org/indexnow", {
        method: "POST", headers: { "Content-Type": "application/json; charset=utf-8" }, signal: AbortSignal.timeout(30000),
        body: JSON.stringify({ host: SITE.host, key: KEY, keyLocation: `${SITE.url}/${KEY}.txt`, urlList: batch }),
      });
      console.log(`indexnow: ${batch.length} pages sent, answer ${r.status}`);
    } catch (e) { console.warn(`indexnow: submission failed (${e.message}); the sitemap will still be read`); }
  }
  if (!urls.length) console.log("indexnow: nothing changed");
} else { console.error("usage: node scripts/indexnow.mjs prepare [dist] | submit"); process.exit(1); }
