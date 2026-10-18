import { defineConfig } from "astro/config";
import sitemap from "@astrojs/sitemap";
import fs from "node:fs";
import zlib from "node:zlib";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { DOSSIERS } from "./src/dossiers/registry.js";
import { SITE } from "./src/site.js";
import hoverOnly from "./scripts/lib/postcss-hover-only.mjs";

// Raw dumps are stored gzipped (data/raw/*.json.gz, scripts/lib/util.mjs). A page that draws on one
// (the learn explainers read the CPI and NAS index levels) imports the .json.gz; this loads it at
// build time as the same JSON module, so nothing gzipped reaches the browser.
const rawGz = {
  name: "atlas-raw-json-gz",
  enforce: "pre",
  load(id) {
    if (!id.endsWith(".json.gz")) return null;
    return `export default ${zlib.gunzipSync(fs.readFileSync(id)).toString("utf8")};`;
  },
};

// Site search is static files under dist/search/, written from the finished pages and the
// bundles once the build is done (scripts/search-index.mjs; budgets in docs/CONTRACT-render.md).
const explorerIndex = {
  name: "atlas-explorer-data",
  hooks: { "astro:build:done": ({ dir }) => {
    execFileSync(process.execPath, [fileURLToPath(new URL("./scripts/explore-pack.mjs", import.meta.url)), fileURLToPath(dir)], { stdio: "inherit" });
  } },
};

const searchIndex = {
  name: "atlas-search-index",
  hooks: {
    "astro:build:done": ({ dir }) => {
      execFileSync(process.execPath, ["--max-old-space-size=8000", fileURLToPath(new URL("./scripts/search-index.mjs", import.meta.url)), fileURLToPath(dir)], { stdio: "inherit" });
    },
  },
};

// Chart kit (src/kit/figure.js): the wide and mid chart drawings a page's placeholders name
// (data-k, a content hash) are written beside the page as kit.json ({ hash: svg }) and fetched by
// src/kit/enhance.js only on screens that show them. A placeholder with no drawing fails the build.
const kitDrawings = {
  name: "atlas-kit-drawings",
  hooks: { "astro:build:done": ({ dir }) => {
    const root = fileURLToPath(dir), ALT = globalThis.__akAlt ?? new Map();
    let files = 0, drawings = 0;
    const walk = (d) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = d + "/" + e.name;
      if (e.isDirectory()) walk(p);
      else if (e.name.endsWith(".html")) {
        const keys = [...new Set([...fs.readFileSync(p, "utf8").matchAll(/data-(?:k|aksk|csvk)="([0-9a-f]{16})"/g)].map((m) => m[1]))];
        if (!keys.length) continue;
        const missing = keys.filter((k) => !ALT.has(k));
        if (missing.length) throw new Error(`kit: ${p} names ${missing.length} drawings the build never made`);
        const out = e.name === "index.html" ? d + "/kit.json" : p.replace(/\.html$/, ".kit.json");
        fs.writeFileSync(out, JSON.stringify(Object.fromEntries(keys.map((k) => [k, ALT.get(k)])))); files++; drawings += keys.length;
      }
    } };
    walk(root.replace(/\/$/, ""));
    console.log(`kit: ${drawings} drawings and data tables in ${files} kit.json files`);
  } },
};

// Site files that need the finished pages (src/pwa/, src/seo/):
// 1. Section anchors. A section's heading gets its id at build time (the slug of its words, the
//    rule src/dossiers/guide.client.js applies at run time to any section still without one), so
//    "#the-current-reading" is in the HTML a crawler or a reader without script sees, and a link
//    to a section is citable. scripts/seo-check.mjs holds anchors to the record in src/seo/anchors.json.
// 2. The service worker: src/pwa/sw.js with this release's id (a hash of every page) and the
//    shell it caches at install, written as dist/sw.js.
const slugOf = (t) => t.toLowerCase().replace(/<[^>]+>/g, "").replace(/&[^;]+;/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 48);
const siteFiles = {
  name: "atlas-site-files",
  hooks: { "astro:build:done": ({ dir }) => {
    const root = fileURLToPath(dir).replace(/\/$/, "");
    const hash = crypto.createHash("sha256");
    const pages = [];
    (function walk(d) { for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = d + "/" + e.name;
      if (e.isDirectory()) walk(p); else if (e.name.endsWith(".html")) pages.push(p);
    } })(root);
    let anchored = 0;
    for (const p of pages.sort()) {
      let html = fs.readFileSync(p, "utf8");
      const used = new Set([...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]));
      const out = html.replace(/<section((?:\s[^>]*)?)>(\s*<div class="sec-head"[^>]*>\s*<span class="no"[^>]*>[^<]*<\/span>\s*<h2[^>]*>)([\s\S]*?)<\/h2>/g, (all, attrs, mid, text) => {
        if (/\sid=/.test(attrs)) return all;
        let id = slugOf(text) || "section";
        while (used.has(id)) id += "-2";
        used.add(id); anchored++;
        return `<section${attrs} id="${id}">${mid}${text}</h2>`;
      });
      if (out !== html) fs.writeFileSync(p, out);
      hash.update(p.slice(root.length)).update(out);
    }
    const build = hash.digest("hex").slice(0, 16);
    const home = fs.readFileSync(root + "/index.html", "utf8"), off = fs.readFileSync(root + "/offline/index.html", "utf8");
    const assets = [...new Set([...(home + off).matchAll(/(?:href|src)="(\/(?:_astro|fonts)\/[^"]+)"/g)].map((m) => m[1]))];
    const shell = ["/offline/", "/manifest.webmanifest", "/favicon.svg", "/icons/icon-192.png", "/icons/maskable-192.png", ...assets];
    const sw = fs.readFileSync(fileURLToPath(new URL("./src/pwa/sw.js", import.meta.url)), "utf8").replace("__BUILD__", build).replace("__SHELL__", JSON.stringify(shell));
    fs.writeFileSync(root + "/sw.js", sw);
    console.log(`site files: ${anchored} section anchors; sw.js for release ${build}, shell of ${shell.length} files`);
  } },
};

// Guides lived at /dossiers/<slug>/ before the 2026-10 redesign; old links keep working.
const redirects = Object.fromEntries(DOSSIERS.map((d) => [`/dossiers/${d.slug}`, `/guides/${d.slug}/`]));

export default defineConfig({
  output: "static",
  // ATLAS_OUT_DIR builds somewhere other than ./dist (a RAM disk when the work disk is short);
  // the gates read the same variable through QC_DIST or their dist argument.
  ...(process.env.ATLAS_OUT_DIR ? { outDir: process.env.ATLAS_OUT_DIR } : {}),
  site: SITE.url,
  redirects,
  integrations: [sitemap({
    // redirects, 404 and the offline page stay out. lastmod is each page's data vintage, which the
    // page records as it renders (src/seo/lastmod.js, via Base.astro): computing it here would load a
    // second copy of every bundle and plan outside the build's module graph.
    filter: (page) => !/^\/(dossiers\/|404\/|offline\/)/.test(new URL(page).pathname),
    serialize: (item) => {
      const lastmod = globalThis.__seoLastmod?.get(new URL(item.url).pathname);
      return lastmod ? { ...item, lastmod } : item;
    },
  }), kitDrawings, explorerIndex, searchIndex, siteFiles],
  build: { inlineStylesheets: "auto" },
  vite: {
    plugins: [rawGz],
    // every chart imports Plot by its package name; the site's Plot (src/charts/plot.js) is Plot
    // plus the phone layout for categorical plates (DESIGN.md §0.4). The module imports the real
    // package by path, so the alias does not loop.
    resolve: { alias: [{ find: /^@observablehq\/plot$/, replacement: fileURLToPath(new URL("./src/charts/plot.js", import.meta.url)) }] },
    build: { assetsInlineLimit: 0 },
    // :hover only where a pointer hovers, so nothing sticks after a tap (scripts/lib/postcss-hover-only.mjs)
    css: { postcss: { plugins: [hoverOnly()] } },
  },
});
