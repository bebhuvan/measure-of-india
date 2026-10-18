// The service worker (served as /sw.js). astro.config.mjs (siteFiles) writes it into dist at the
// end of each build, replacing BUILD and SHELL, so every release is a new worker and its shell
// cache is named by the release. Policy (docs/PLAN-seo-pwa.md):
//   pages and kit.json   network first. If the network has not answered in TIMEOUT ms and a saved
//                        copy exists, the copy is shown, marked at the top of the page with the day
//                        it was saved; with no connection and no copy, /offline/. Never a stale page
//                        dressed as the live one.
//   hashed files         cache first (/_astro/, /fonts/, search shards, every-cut packs, explorer
//                        chunks): a hashed name never changes its bytes.
//   downloads, feeds     network only (/data/*.csv|json, feeds, sitemaps): files people keep.
// The shell (offline page, front page, manifest, icons, the fonts the layout preloads) is cached at
// install under the release's name; older shells are deleted on activate. Saved pages and hashed
// files survive a release, so a page saved last week still opens offline with its own assets, and
// are trimmed oldest first.
const BUILD = "__BUILD__";
const SHELL = __SHELL__;
const SHELL_CACHE = `moi-shell-${BUILD}`, PAGES = "moi-pages-v1", ASSETS = "moi-assets-v1";
const TIMEOUT = 4000, MAX_PAGES = 120, MAX_ASSETS = 400;
const HASHED = /^\/(?:_astro|fonts|ec|explore-data\/c|search\/[trbux])\//;
const NETWORK_ONLY = /^\/(?:data\/[^/]+\.(?:csv|json|xlsx)|feeds\/|rss\.xml|sitemap|robots\.txt|llms|sw\.js)/;
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

self.addEventListener("install", (e) => {
  e.waitUntil((async () => {
    const shell = await caches.open(SHELL_CACHE);
    await shell.addAll(SHELL);
    // the front page also goes to the saved pages, stamped, so the app opens offline
    const front = await fetch("/", { cache: "reload" }).catch(() => null);
    if (front?.ok) await (await caches.open(PAGES)).put("/", await stamp(front));
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (e) => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k.startsWith("moi-shell-") && k !== SHELL_CACHE) await caches.delete(k);
    if (self.registration.navigationPreload) await self.registration.navigationPreload.enable();
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (e) => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== location.origin || NETWORK_ONLY.test(url.pathname)) return;
  if (req.mode === "navigate") return e.respondWith(page(e));
  if (HASHED.test(url.pathname)) return e.respondWith(hashed(req));
  if (/(?:^|\/|\.)kit\.json$/.test(url.pathname) || url.pathname === "/search/core.json") return e.respondWith(fresh(req));
});

// a response copied with the moment it was saved, read back when the copy is shown
async function stamp(res) {
  const h = new Headers(res.headers);
  h.set("x-moi-saved", String(Date.now()));
  return new Response(await res.blob(), { status: res.status, statusText: res.statusText, headers: h });
}

async function trim(name, max) {
  const c = await caches.open(name), keys = await c.keys();
  for (const k of keys.slice(0, Math.max(0, keys.length - max))) await c.delete(k);
}

// network first, with a saved copy only when the network fails or is slow
async function fresh(req, preload) {
  const cache = await caches.open(PAGES);
  const key = req.mode === "navigate" ? new URL(req.url).pathname : req;
  const net = (async () => {
    const res = (await preload) || (await fetch(req));
    if (res.ok && res.type === "basic") { await cache.put(key, await stamp(res.clone())); trim(PAGES, MAX_PAGES); }
    return res;
  })();
  net.catch(() => {});   // a late failure after a saved copy was shown is not an error
  const saved = () => cache.match(key, { ignoreSearch: req.mode === "navigate" });
  const slow = new Promise((r) => setTimeout(r, TIMEOUT, "slow"));
  try {
    const first = await Promise.race([net, slow]);
    if (first !== "slow") return first;
    const copy = await saved();
    return copy ? marked(copy, req) : await net;
  } catch {
    const copy = await saved();
    if (copy) return marked(copy, req);
    if (req.mode === "navigate") return (await caches.match("/offline/")) || Response.error();
    return Response.error();
  }
}

const page = (e) => fresh(e.request, e.preloadResponse);

// a saved page says so at its top: the day it was saved, and that the figures may have moved since
async function marked(copy, req) {
  if (req.mode !== "navigate" || !(copy.headers.get("content-type") || "").includes("text/html")) return copy;
  const t = new Date(+copy.headers.get("x-moi-saved") || Date.now());
  const day = `${t.getDate()} ${MONTHS[t.getMonth()]} ${t.getFullYear()}`;
  const note = `<p class="saved-copy" role="status">A copy saved on this device on ${day}, shown because the network did not answer. Figures may have been revised since. <a href="">Try again</a></p>`;
  const html = (await copy.text()).replace(/<main id="main">/, `<main id="main">${note}`);
  return new Response(html, { status: 200, headers: copy.headers });
}

async function hashed(req) {
  const hit = await caches.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok && res.type === "basic") { (await caches.open(ASSETS)).put(req, res.clone()).then(() => trim(ASSETS, MAX_ASSETS)); }
  return res;
}
